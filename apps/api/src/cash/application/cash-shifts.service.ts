import type {
  CashConsolidationDto,
  CashShiftDto,
  CashShiftListDto,
  CloseCashShiftDto,
  CreateCashCorrectionDto,
  PaymentMethodDto,
} from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import { validateReason } from '../../audit/domain/audit';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import { CASH_METHODS, cashTotals, parseCashAmount, zeroByMethod } from '../domain/cash';

const detailInclude = {
  user: { select: { id: true, username: true } },
  movements: {
    include: {
      actor: { select: { id: true, username: true } },
      sourcePayment: {
        select: { student: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
  },
  closingLines: { orderBy: { method: 'asc' as const } },
  corrections: {
    include: { createdBy: { select: { id: true, username: true } } },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
};
type DetailedShift = Prisma.CashShiftGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class CashShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async open(actorId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cash-open:${actorId}`}))`;
        if (await tx.cashShift.findFirst({ where: { userId: actorId, status: 'OPEN' } }))
          throw new DomainError('CASH_SHIFT_ALREADY_OPEN', 'Ya tenés un turno de caja abierto');
        const shift = await tx.cashShift.create({ data: { userId: actorId } });
        await tx.auditLog.create({
          data: {
            actorUserId: actorId,
            action: 'OPEN',
            entityType: 'CASH_SHIFT',
            entityId: shift.id,
            after: { status: 'OPEN' },
          },
        });
        return this.detailIn(tx, shift.id);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new DomainError('CASH_SHIFT_ALREADY_OPEN', 'Ya tenés un turno de caja abierto');
      throw error;
    }
  }

  async current(actorId: string) {
    const shift = await this.prisma.cashShift.findFirst({
      where: { userId: actorId, status: 'OPEN' },
      include: detailInclude,
    });
    return shift ? this.mapDetail(shift) : null;
  }

  async get(id: string, actorId: string, canReconcile: boolean) {
    const shift = await this.prisma.cashShift.findUnique({ where: { id }, include: detailInclude });
    if (!shift) throw new DomainError('CASH_SHIFT_NOT_FOUND', 'Turno de caja no encontrado');
    if (!canReconcile && shift.userId !== actorId)
      throw new DomainError('FORBIDDEN', 'No podés consultar el turno de otro usuario');
    return this.mapDetail(shift);
  }

  async list(
    actorId: string,
    canReconcile: boolean,
    page: number,
    pageSize: number,
  ): Promise<CashShiftListDto> {
    const where: Prisma.CashShiftWhereInput = canReconcile ? {} : { userId: actorId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cashShift.findMany({
        where,
        include: {
          user: { select: { id: true, username: true } },
          closingLines: true,
          corrections: { select: { id: true } },
          movements: { select: { type: true, amount: true } },
        },
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.cashShift.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        user: item.user,
        status: item.status,
        openedAt: item.openedAt.toISOString(),
        closedAt: item.closedAt?.toISOString() ?? null,
        expectedAmount: item.closingLines
          .reduce((sum, line) => sum.plus(line.expectedAmount), new Prisma.Decimal(0))
          .toFixed(2),
        declaredAmount:
          item.status === 'CLOSED'
            ? item.closingLines
                .reduce((sum, line) => sum.plus(line.declaredAmount), new Prisma.Decimal(0))
                .toFixed(2)
            : null,
        differenceAmount:
          item.status === 'CLOSED'
            ? item.closingLines
                .reduce((sum, line) => sum.plus(line.differenceAmount), new Prisma.Decimal(0))
                .toFixed(2)
            : null,
        hasCorrections: item.corrections.length > 0,
      })),
      total,
      page,
      pageSize,
    };
  }

  async close(id: string, input: CloseCashShiftDto, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM cash_shifts WHERE id = ${id}::uuid FOR UPDATE`;
        const shift = await tx.cashShift.findUnique({
          where: { id },
          include: { movements: true },
        });
        if (!shift) throw new DomainError('CASH_SHIFT_NOT_FOUND', 'Turno de caja no encontrado');
        if (shift.userId !== actorId)
          throw new DomainError('FORBIDDEN', 'Sólo podés cerrar tu propio turno');
        if (shift.status !== 'OPEN')
          throw new DomainError('CASH_SHIFT_ALREADY_CLOSED', 'El turno ya está cerrado');
        const expected = cashTotals(shift.movements);
        const declared = Object.fromEntries(
          CASH_METHODS.map((method) => [
            method,
            parseCashAmount(input?.declaredByMethod?.[method], `declaredByMethod.${method}`),
          ]),
        ) as Record<PaymentMethodDto, Prisma.Decimal>;
        await tx.cashShiftClosingLine.createMany({
          data: CASH_METHODS.map((method) => ({
            cashShiftId: id,
            method,
            expectedAmount: expected[method],
            declaredAmount: declared[method],
            differenceAmount: declared[method].minus(expected[method]),
          })),
        });
        const closedAt = new Date();
        await tx.cashShift.update({
          where: { id },
          data: { status: 'CLOSED', closedAt, closedByUserId: actorId },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: actorId,
            action: 'CLOSE',
            entityType: 'CASH_SHIFT',
            entityId: id,
            before: { status: 'OPEN' },
            after: {
              status: 'CLOSED',
              closedAt,
              declaredByMethod: Object.fromEntries(
                CASH_METHODS.map((method) => [method, declared[method].toFixed(2)]),
              ),
            },
          },
        });
        return this.detailIn(tx, id);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async correct(id: string, input: CreateCashCorrectionDto, actorId: string) {
    const reason = validateReason(input?.reason);
    if (!CASH_METHODS.includes(input?.method))
      throw new DomainError('VALIDATION_ERROR', 'Medio de pago inválido', { field: 'method' });
    const corrected = parseCashAmount(input?.correctedDeclaredAmount, 'correctedDeclaredAmount');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM cash_shifts WHERE id = ${id}::uuid FOR UPDATE`;
      const shift = await tx.cashShift.findUnique({
        where: { id },
        include: { closingLines: true, corrections: true },
      });
      if (!shift) throw new DomainError('CASH_SHIFT_NOT_FOUND', 'Turno de caja no encontrado');
      if (shift.status !== 'CLOSED')
        throw new DomainError('CASH_SHIFT_OPEN', 'El turno todavía está abierto');
      const line = shift.closingLines.find(({ method }) => method === input.method)!;
      const before = shift.corrections
        .filter(({ method }) => method === input.method)
        .reduce((sum, item) => sum.plus(item.amountDelta), line.declaredAmount);
      await tx.cashReconciliationCorrection.create({
        data: {
          cashShiftId: id,
          method: input.method,
          amountDelta: corrected.minus(before),
          originalDeclaredAmount: line.declaredAmount,
          correctedDeclaredAmount: corrected,
          reason,
          createdByUserId: actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'CORRECTION',
          entityType: 'CASH_SHIFT',
          entityId: id,
          reason,
          before: { method: input.method, declaredAmount: before.toFixed(2) },
          after: { method: input.method, declaredAmount: corrected.toFixed(2) },
        },
      });
      return this.detailIn(tx, id);
    });
  }

  async consolidated(from: Date, toExclusive: Date): Promise<CashConsolidationDto> {
    const shifts = await this.prisma.cashShift.findMany({
      where: { status: 'CLOSED', closedAt: { gte: from, lt: toExclusive } },
      include: { closingLines: true, corrections: true, movements: true },
    });
    return {
      shiftCount: shifts.length,
      byMethod: CASH_METHODS.map((method) => {
        let systemAtClose = new Prisma.Decimal(0),
          declaredAtClose = new Prisma.Decimal(0),
          currentSystem = new Prisma.Decimal(0),
          correctedDeclared = new Prisma.Decimal(0);
        for (const shift of shifts) {
          const line = shift.closingLines.find((item) => item.method === method)!;
          systemAtClose = systemAtClose.plus(line.expectedAmount);
          declaredAtClose = declaredAtClose.plus(line.declaredAmount);
          currentSystem = currentSystem.plus(cashTotals(shift.movements)[method]);
          correctedDeclared = correctedDeclared.plus(
            shift.corrections
              .filter((item) => item.method === method)
              .reduce((sum, item) => sum.plus(item.amountDelta), line.declaredAmount),
          );
        }
        return {
          method,
          systemAtClose: systemAtClose.toFixed(2),
          declaredAtClose: declaredAtClose.toFixed(2),
          differenceAtClose: declaredAtClose.minus(systemAtClose).toFixed(2),
          postCloseMovements: currentSystem.minus(systemAtClose).toFixed(2),
          currentSystem: currentSystem.toFixed(2),
          correctedDeclared: correctedDeclared.toFixed(2),
          currentDifference: correctedDeclared.minus(currentSystem).toFixed(2),
        };
      }),
    };
  }

  private async detailIn(tx: Prisma.TransactionClient, id: string) {
    return this.mapDetail(
      await tx.cashShift.findUniqueOrThrow({ where: { id }, include: detailInclude }),
    );
  }
  private mapDetail(shift: DetailedShift): CashShiftDto {
    const current = cashTotals(shift.movements);
    const expectedByMethod = Object.fromEntries(
      CASH_METHODS.map((method) => [method, current[method].toFixed(2)]),
    ) as CashShiftDto['expectedByMethod'];
    const closingLines = shift.closingLines.map((line) => ({
      method: line.method,
      expectedAmount: line.expectedAmount.toFixed(2),
      declaredAmount: line.declaredAmount.toFixed(2),
      differenceAmount: line.differenceAmount.toFixed(2),
    }));
    const correctedByMethod =
      shift.status === 'CLOSED'
        ? CASH_METHODS.map((method) => {
            const line = shift.closingLines.find((item) => item.method === method)!;
            const declared = shift.corrections
              .filter((item) => item.method === method)
              .reduce((sum, item) => sum.plus(item.amountDelta), line.declaredAmount);
            return {
              method,
              expectedAmount: current[method].toFixed(2),
              declaredAmount: declared.toFixed(2),
              differenceAmount: declared.minus(current[method]).toFixed(2),
            };
          })
        : [];
    return {
      id: shift.id,
      user: shift.user,
      status: shift.status,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString() ?? null,
      expectedByMethod,
      operationCount: new Set(
        shift.movements
          .filter(({ type }) => type === 'COLLECTION')
          .map(({ sourcePaymentId }) => sourcePaymentId),
      ).size,
      movements: shift.movements.map((movement) => ({
        id: movement.id,
        type: movement.type,
        method: movement.method,
        amount: movement.amount.toFixed(2),
        paymentId: movement.sourcePaymentId,
        student: movement.sourcePayment.student,
        actor: movement.actor,
        reason: movement.reason,
        createdAt: movement.createdAt.toISOString(),
      })),
      closingLines,
      corrections: shift.corrections.map((item) => ({
        id: item.id,
        method: item.method,
        amountDelta: item.amountDelta.toFixed(2),
        originalDeclaredAmount: item.originalDeclaredAmount.toFixed(2),
        correctedDeclaredAmount: item.correctedDeclaredAmount.toFixed(2),
        reason: item.reason,
        createdBy: item.createdBy,
        createdAt: item.createdAt.toISOString(),
      })),
      correctedByMethod,
      hasPostCloseMovements: Boolean(
        shift.closedAt && shift.movements.some(({ createdAt }) => createdAt > shift.closedAt!),
      ),
    };
  }
}
