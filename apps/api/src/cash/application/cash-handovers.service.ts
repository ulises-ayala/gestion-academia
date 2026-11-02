import type { CashCollectedDto, CashHandoverDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import { validateReason } from '../../audit/domain/audit';
import { businessDayAt } from '../../dashboard/application/business-day';
import { PrismaService } from '../../database/prisma.service';
import { withSerializableRetry } from '../../database/serializable-retry';
import { DomainError } from '../../shared/domain/domain-error';
import { validateCashHandover } from '../domain/cash-handover';

const timeZone = () => process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires';
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const include = {
  createdBy: { select: { id: true, username: true } },
  voidedBy: { select: { id: true, username: true } },
};
type IncludedHandover = Prisma.CashHandoverGetPayload<{ include: typeof include }>;
const mapHandover = (item: IncludedHandover): CashHandoverDto => ({
  id: item.id,
  fromDate: isoDate(item.fromDate),
  toDate: isoDate(item.toDate),
  amount: item.amount.toFixed(2),
  collectedAmount: item.collectedAmount.toFixed(2),
  difference: item.amount.minus(item.collectedAmount).toFixed(2),
  receivedBy: item.receivedBy,
  note: item.note,
  createdBy: item.createdBy,
  createdAt: item.createdAt.toISOString(),
  voidedAt: item.voidedAt?.toISOString() ?? null,
  voidedBy: item.voidedBy,
  voidReason: item.voidReason,
});

/**
 * Entregas del efectivo recaudado a Dirección. No son gastos ni movimientos de un turno: registran
 * qué período de recaudación cubren y cuánto se entregó frente al efectivo cobrado.
 */
@Injectable()
export class CashHandoversService {
  constructor(private readonly prisma: PrismaService) {}

  /** Inicio del primer día y fin del último día del período, en hora de Buenos Aires. */
  private range(fromDate: string, toDate: string) {
    const day = (date: string) => businessDayAt(new Date(`${date}T15:00:00.000Z`), timeZone());
    return { from: day(fromDate).start, toExclusive: day(toDate).end };
  }

  private async collected(
    client: Prisma.TransactionClient | PrismaService,
    fromDate: string,
    toDate: string,
  ) {
    const { from, toExclusive } = this.range(fromDate, toDate);
    const result = await client.paymentTender.aggregate({
      where: {
        method: 'CASH',
        payment: { status: 'CONFIRMED', paidAt: { gte: from, lt: toExclusive } },
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? new Prisma.Decimal(0);
  }

  /** Efectivo cobrado en el período (pagos confirmados por su fecha de pago). */
  async cashCollected(
    fromDate: unknown,
    toDate: unknown,
    now = new Date(),
  ): Promise<CashCollectedDto> {
    // Valida las fechas con las mismas reglas que la entrega (el importe no importa acá).
    const period = validateCashHandover(
      { fromDate, toDate, amount: '1' },
      businessDayAt(now, timeZone()).date,
    );
    return {
      fromDate: period.fromDate,
      toDate: period.toDate,
      collected: (await this.collected(this.prisma, period.fromDate, period.toDate)).toFixed(2),
    };
  }

  async list(page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.cashHandover.findMany({
        include,
        orderBy: [{ toDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.cashHandover.count(),
    ]);
    return { items: items.map(mapHandover), total, page, pageSize };
  }

  async create(input: unknown, actorId: string, now = new Date()) {
    const handover = validateCashHandover(
      input as Parameters<typeof validateCashHandover>[0],
      businessDayAt(now, timeZone()).date,
    );
    return withSerializableRetry(
      () =>
        this.prisma.$transaction(
          async (tx) => {
            // Dos entregas vigentes no pueden cubrir el mismo día: se contaría dos veces.
            const overlapping = await tx.cashHandover.findFirst({
              where: {
                voidedAt: null,
                fromDate: { lte: new Date(`${handover.toDate}T00:00:00.000Z`) },
                toDate: { gte: new Date(`${handover.fromDate}T00:00:00.000Z`) },
              },
            });
            if (overlapping)
              throw new DomainError(
                'CASH_HANDOVER_OVERLAP_CONFLICT',
                `Ya hay una entrega del ${isoDate(overlapping.fromDate)} al ${isoDate(overlapping.toDate)}. Anulala o elegí otro período.`,
              );
            const collectedAmount = await this.collected(tx, handover.fromDate, handover.toDate);
            const created = await tx.cashHandover.create({
              data: {
                fromDate: new Date(`${handover.fromDate}T00:00:00.000Z`),
                toDate: new Date(`${handover.toDate}T00:00:00.000Z`),
                amount: handover.amount,
                collectedAmount,
                receivedBy: handover.receivedBy,
                note: handover.note,
                createdByUserId: actorId,
              },
              include,
            });
            await tx.auditLog.create({
              data: {
                actorUserId: actorId,
                action: 'CREATE',
                entityType: 'CASH_HANDOVER',
                entityId: created.id,
                after: {
                  fromDate: handover.fromDate,
                  toDate: handover.toDate,
                  amount: handover.amount.toFixed(2),
                  collectedAmount: collectedAmount.toFixed(2),
                  receivedBy: handover.receivedBy,
                },
              },
            });
            return mapHandover(created);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      () =>
        new DomainError(
          'CASH_HANDOVER_CONCURRENCY_CONFLICT',
          'Otra persona registró una entrega al mismo tiempo. Actualizá y probá de nuevo.',
        ),
    );
  }

  async void(id: string, reasonInput: unknown, actorId: string) {
    const reason = validateReason(reasonInput);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM cash_handovers WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await tx.cashHandover.findUnique({ where: { id } });
      if (!current) throw new DomainError('CASH_HANDOVER_NOT_FOUND', 'Entrega no encontrada');
      if (current.voidedAt)
        throw new DomainError('CASH_HANDOVER_VOID_CONFLICT', 'La entrega ya está anulada');
      const updated = await tx.cashHandover.update({
        where: { id },
        data: { voidedAt: new Date(), voidedByUserId: actorId, voidReason: reason },
        include,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'VOID',
          entityType: 'CASH_HANDOVER',
          entityId: id,
          reason,
          before: { voided: false },
          after: { voided: true },
          metadata: { amount: current.amount.toFixed(2) },
        },
      });
      return mapHandover(updated);
    });
  }
}
