import type { PaymentDto, PaymentMethodDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import type { PaymentQuery, PaymentsRepository } from '../application/payments.repository';

const include = {
  student: { select: { id: true, dni: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, username: true } },
  voidedBy: { select: { id: true, username: true } },
  allocations: {
    include: {
      monthlyCharge: {
        include: { enrollment: { include: { class: { select: { id: true, name: true } } } } },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};
type IncludedPayment = Prisma.PaymentGetPayload<{ include: typeof include }>;
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const mapPayment = (item: IncludedPayment): PaymentDto => ({
  id: item.id,
  student: item.student,
  amount: item.amount.toFixed(2),
  paymentMethod: item.paymentMethod,
  status: item.status,
  paidAt: item.paidAt.toISOString(),
  createdBy: item.createdBy,
  voidedAt: item.voidedAt?.toISOString() ?? null,
  voidedBy: item.voidedBy,
  allocations: item.allocations.map(({ monthlyCharge, amount }) => ({
    monthlyChargeId: monthlyCharge.id,
    amount: amount.toFixed(2),
    period: isoDate(monthlyCharge.period).slice(0, 7),
    dueDate: isoDate(monthlyCharge.dueDate),
    academicClass: monthlyCharge.enrollment.class,
    finalAmount: monthlyCharge.finalAmount.toFixed(2),
  })),
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});
const isRetryableTransactionError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === 'P2034' ||
    (error.code === 'P2010' && /40001|40P01|serializ|deadlock/i.test(JSON.stringify(error.meta))));

@Injectable()
export class PrismaPaymentsRepository implements PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(ids: readonly string[], paymentMethod: PaymentMethodDto, actorId: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM monthly_charges WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
            const charges = await tx.monthlyCharge.findMany({
              where: { id: { in: [...ids] } },
              orderBy: { id: 'asc' },
            });
            if (charges.length !== ids.length)
              throw new DomainError('PAYMENT_CHARGE_NOT_FOUND', 'Una o más cuotas no existen');
            if (new Set(charges.map((charge) => charge.studentId)).size !== 1)
              throw new DomainError(
                'PAYMENT_MIXED_STUDENTS',
                'Todas las cuotas deben pertenecer al mismo alumno',
              );
            if (charges.some((charge) => charge.status !== 'PENDING'))
              throw new DomainError(
                'PAYMENT_CHARGE_NOT_PENDING',
                'Una o más cuotas ya no están pendientes',
              );
            const amount = charges.reduce(
              (total, charge) => total.add(charge.finalAmount),
              new Prisma.Decimal(0),
            );
            const payment = await tx.payment.create({
              data: {
                studentId: charges[0]!.studentId,
                amount,
                paymentMethod,
                createdByUserId: actorId,
                allocations: {
                  create: charges.map((charge) => ({
                    monthlyChargeId: charge.id,
                    amount: charge.finalAmount,
                  })),
                },
              },
              include,
            });
            await tx.monthlyCharge.updateMany({
              where: { id: { in: [...ids] }, status: 'PENDING' },
              data: { status: 'PAID' },
            });
            return mapPayment(payment);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryableTransactionError(error)) {
          if (attempt < 2) continue;
          throw new DomainError(
            'PAYMENT_CONCURRENCY_CONFLICT',
            'La cuota fue modificada por otro cobro. Actualizá e intentá nuevamente.',
          );
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')
          throw new DomainError(
            'PAYMENT_RELATION_NOT_FOUND',
            'El usuario o la cuota indicada no existe',
          );
        throw error;
      }
    }
    throw new DomainError(
      'PAYMENT_CONCURRENCY_CONFLICT',
      'La cuota fue modificada por otro cobro. Actualizá e intentá nuevamente.',
    );
  }

  async findById(id: string) {
    const item = await this.prisma.payment.findUnique({ where: { id }, include });
    return item ? mapPayment(item) : null;
  }

  async findPage(query: PaymentQuery) {
    const where = {
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include,
        orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items: items.map(mapPayment), total, page: query.page, pageSize: query.pageSize };
  }

  async void(id: string, actorId: string, reason: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM payments WHERE id = ${id}::uuid FOR UPDATE`;
            const current = await tx.payment.findUnique({
              where: { id },
              include: { allocations: { select: { monthlyChargeId: true } } },
            });
            if (!current) throw new DomainError('PAYMENT_NOT_FOUND', 'Pago no encontrado');
            if (current.status === 'VOID')
              throw new DomainError('PAYMENT_ALREADY_VOID', 'El pago ya está anulado');
            const chargeIds = current.allocations
              .map((allocation) => allocation.monthlyChargeId)
              .sort();
            await tx.$queryRaw`SELECT id FROM monthly_charges WHERE id IN (${Prisma.join(chargeIds.map((chargeId) => Prisma.sql`${chargeId}::uuid`))}) ORDER BY id FOR UPDATE`;
            await tx.monthlyCharge.updateMany({
              where: { id: { in: chargeIds } },
              data: { status: 'PENDING' },
            });
            const updated = await tx.payment.update({
              where: { id },
              data: { status: 'VOID', voidedAt: new Date(), voidedByUserId: actorId },
              include,
            });
            await tx.auditLog.create({
              data: {
                actorUserId: actorId,
                action: 'VOID',
                entityType: 'PAYMENT',
                entityId: id,
                reason,
                before: { status: current.status },
                after: { status: updated.status },
                metadata: {
                  studentId: current.studentId,
                  amount: current.amount.toFixed(2),
                  paymentMethod: current.paymentMethod,
                },
              },
            });
            return mapPayment(updated);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryableTransactionError(error)) {
          if (attempt < 2) continue;
          throw new DomainError(
            'PAYMENT_CONCURRENCY_CONFLICT',
            'El pago fue modificado al mismo tiempo. Actualizá e intentá nuevamente.',
          );
        }
        throw error;
      }
    }
    throw new DomainError(
      'PAYMENT_CONCURRENCY_CONFLICT',
      'El pago fue modificado al mismo tiempo. Actualizá e intentá nuevamente.',
    );
  }
}
