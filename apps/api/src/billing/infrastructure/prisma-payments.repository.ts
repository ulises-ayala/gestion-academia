import type { OtherPaymentConceptDto, PaymentDto, PaymentMethodDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  SERIALIZABLE_TRANSACTION_ATTEMPTS,
  isSerializationConflict,
  waitBeforeSerializableRetry,
} from '../../database/serializable-retry';
import { DomainError } from '../../shared/domain/domain-error';
import type { PaymentQuery, PaymentsRepository } from '../application/payments.repository';
import {
  buildPaymentAllocationPlan,
  confirmedAllocatedAmount,
  paymentChargeStatus,
} from '../domain/payment-allocation';
import { adjustedAmounts, LATE_FEE_AMOUNT } from '../domain/billing-adjustments';
import { businessDayAt } from '../../dashboard/application/business-day';

const include = {
  student: { select: { id: true, dni: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, username: true } },
  voidedBy: { select: { id: true, username: true } },
  academicClass: { select: { id: true, name: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
  tenders: { orderBy: [{ method: 'asc' as const }, { id: 'asc' as const }] },
  allocations: {
    include: {
      monthlyCharge: {
        include: {
          enrollment: { include: { class: { select: { id: true, name: true } } } },
          adjustments: true,
        },
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
  tenders: item.tenders.map((tender) => ({
    id: tender.id,
    method: tender.method,
    amount: tender.amount.toFixed(2),
  })),
  status: item.status,
  paidAt: item.paidAt.toISOString(),
  createdBy: item.createdBy,
  voidedAt: item.voidedAt?.toISOString() ?? null,
  voidedBy: item.voidedBy,
  allocations: item.allocations.map(({ monthlyCharge, amount }) => ({
    monthlyChargeId: monthlyCharge.id,
    amount: amount.toFixed(2),
    kind: monthlyCharge.kind,
    description: monthlyCharge.description,
    period: isoDate(monthlyCharge.period).slice(0, 7),
    dueDate: isoDate(monthlyCharge.dueDate),
    academicClass: monthlyCharge.enrollment.class,
    finalAmount: monthlyCharge.finalAmount.toFixed(2),
    studentDueAmount: adjustedAmounts(
      monthlyCharge.baseAmount,
      monthlyCharge.adjustments,
    ).studentDue.toFixed(2),
  })),
  kind: item.kind,
  otherConcept:
    item.kind === 'OTHER' && item.concept
      ? {
          concept: item.concept,
          detail: item.conceptDetail,
          academicClass: item.academicClass,
          teacher: item.teacher,
        }
      : null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});
const isRetryableTransactionError = isSerializationConflict;
const waitBeforeRetry = waitBeforeSerializableRetry;
/** Ver `database/serializable-retry.ts`: el reintento posterior ve el saldo ya actualizado. */
export const PAYMENT_TRANSACTION_ATTEMPTS = SERIALIZABLE_TRANSACTION_ATTEMPTS;
@Injectable()
export class PrismaPaymentsRepository implements PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    studentId: string,
    tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[],
    actorId: string,
  ) {
    for (let attempt = 0; attempt < PAYMENT_TRANSACTION_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const [cashShift] = await tx.$queryRaw<readonly { id: string }[]>`
              SELECT id FROM cash_shifts
              WHERE user_id = ${actorId}::uuid AND status = 'OPEN'
              FOR UPDATE
            `;
            if (!cashShift)
              throw new DomainError(
                'CASH_SHIFT_REQUIRED',
                'Necesitás abrir tu turno de caja antes de registrar un cobro.',
              );
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`;
            await tx.$queryRaw`SELECT id FROM monthly_charges WHERE student_id = ${studentId}::uuid AND status <> 'VOID' ORDER BY due_date, created_at, id FOR UPDATE`;
            const lockedCharges = await tx.monthlyCharge.findMany({
              where: { studentId, status: { not: 'VOID' } },
              include: {
                adjustments: true,
                allocations: {
                  where: { payment: { status: 'CONFIRMED' } },
                  select: { amount: true },
                },
              },
              orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
            });
            const today = businessDayAt(
              new Date(),
              process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires',
            ).dateValue;
            for (const charge of lockedCharges) {
              if (
                charge.kind !== 'MONTHLY' ||
                charge.dueDate >= today ||
                charge.adjustments.some(({ type }) => type === 'LATE_FEE')
              )
                continue;
              const paid = confirmedAllocatedAmount(charge.allocations);
              const due = adjustedAmounts(charge.baseAmount, charge.adjustments).studentDue;
              if (due.minus(paid).lessThanOrEqualTo(0)) continue;
              await tx.monthlyChargeAdjustment.create({
                data: {
                  monthlyChargeId: charge.id,
                  type: 'LATE_FEE',
                  calculation: 'FIXED',
                  configuredValue: LATE_FEE_AMOUNT,
                  effectiveAmount: LATE_FEE_AMOUNT,
                  studentAmountDelta: LATE_FEE_AMOUNT,
                  settlementBaseDelta: LATE_FEE_AMOUNT,
                  reason: 'Recargo fijo por vencimiento',
                },
              });
            }
            const materializedCharges = await tx.monthlyCharge.findMany({
              where: { studentId, status: { not: 'VOID' } },
              include: {
                adjustments: true,
                allocations: {
                  where: { payment: { status: 'CONFIRMED' } },
                  select: { amount: true },
                },
              },
              orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
            });
            const charges = materializedCharges.map((charge) => ({
              ...charge,
              studentDueAmount: adjustedAmounts(charge.baseAmount, charge.adjustments).studentDue,
            }));
            const amount = tenders.reduce(
              (sum, tender) => sum.plus(tender.amount),
              new Prisma.Decimal(0),
            );
            const plan = buildPaymentAllocationPlan(charges, amount);
            const { allocations, balances, totalOutstanding } = plan;
            if (amount.greaterThan(totalOutstanding))
              throw new DomainError(
                'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE',
                'El cobro supera la deuda pendiente actual del alumno',
                { outstandingAmount: totalOutstanding.toFixed(2) },
              );
            if (!plan.remaining.isZero() || allocations.length === 0)
              throw new DomainError(
                'PAYMENT_NO_OUTSTANDING_BALANCE',
                'El alumno no tiene deuda pendiente',
              );
            const payment = await tx.payment.create({
              data: {
                studentId,
                amount,
                createdByUserId: actorId,
                tenders: {
                  create: tenders.map((tender) => ({
                    method: tender.method,
                    amount: tender.amount,
                  })),
                },
                allocations: { create: allocations },
              },
              include,
            });
            await tx.cashMovement.createMany({
              data: payment.tenders.map((tender) => ({
                cashShiftId: cashShift.id,
                type: 'COLLECTION',
                method: tender.method,
                amount: tender.amount,
                sourcePaymentId: payment.id,
                sourcePaymentTenderId: tender.id,
                actorUserId: actorId,
              })),
            });
            for (const allocation of allocations) {
              const balance = balances.find(
                ({ charge }) => charge.id === allocation.monthlyChargeId,
              )!;
              await tx.monthlyCharge.update({
                where: { id: balance.charge.id },
                data: {
                  status: paymentChargeStatus(
                    balance.paid.plus(allocation.amount),
                    balance.charge.studentDueAmount,
                  ),
                },
              });
            }
            return mapPayment(payment);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryableTransactionError(error)) {
          if (attempt < PAYMENT_TRANSACTION_ATTEMPTS - 1) {
            await waitBeforeRetry(attempt);
            continue;
          }
          throw new DomainError(
            'PAYMENT_CONCURRENCY_CONFLICT',
            'La deuda cambió mientras registrabas el pago. Actualizá el estado de cuenta.',
          );
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')
          throw new DomainError(
            'PAYMENT_RELATION_NOT_FOUND',
            'El usuario o alumno indicado no existe',
          );
        throw error;
      }
    }
    throw new DomainError(
      'PAYMENT_CONCURRENCY_CONFLICT',
      'La deuda cambió mientras registrabas el pago.',
    );
  }

  async createOther(
    data: Readonly<{
      studentId: string;
      concept: OtherPaymentConceptDto;
      classId: string | null;
      teacherId: string | null;
      detail: string | null;
    }>,
    tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[],
    actorId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Mismo resguardo que un cobro de cuotas: el turno propio abierto, bloqueado.
        const [cashShift] = await tx.$queryRaw<readonly { id: string }[]>`
          SELECT id FROM cash_shifts
          WHERE user_id = ${actorId}::uuid AND status = 'OPEN'
          FOR UPDATE
        `;
        if (!cashShift)
          throw new DomainError(
            'CASH_SHIFT_REQUIRED',
            'Necesitás abrir tu turno de caja antes de registrar un cobro.',
          );
        const amount = tenders.reduce(
          (sum, tender) => sum.plus(tender.amount),
          new Prisma.Decimal(0),
        );
        const payment = await tx.payment.create({
          data: {
            studentId: data.studentId,
            amount,
            kind: 'OTHER',
            concept: data.concept,
            conceptDetail: data.detail,
            classId: data.classId,
            teacherId: data.teacherId,
            createdByUserId: actorId,
            tenders: {
              create: tenders.map((tender) => ({ method: tender.method, amount: tender.amount })),
            },
          },
          include,
        });
        await tx.cashMovement.createMany({
          data: payment.tenders.map((tender) => ({
            cashShiftId: cashShift.id,
            type: 'COLLECTION',
            method: tender.method,
            amount: tender.amount,
            sourcePaymentId: payment.id,
            sourcePaymentTenderId: tender.id,
            actorUserId: actorId,
          })),
        });
        await tx.auditLog.create({
          data: {
            actorUserId: actorId,
            action: 'CREATE',
            entityType: 'PAYMENT',
            entityId: payment.id,
            after: {
              kind: 'OTHER',
              concept: data.concept,
              detail: data.detail,
              classId: data.classId,
              teacherId: data.teacherId,
              amount: amount.toFixed(2),
              tenders: tenders.map((tender) => ({ method: tender.method, amount: tender.amount })),
            },
            metadata: { studentId: data.studentId },
          },
        });
        return mapPayment(payment);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')
        throw new DomainError(
          'PAYMENT_RELATION_NOT_FOUND',
          'El alumno o la clase indicada no existe',
        );
      throw error;
    }
  }

  findClass(classId: string) {
    return this.prisma.academyClass.findUnique({
      where: { id: classId },
      select: { status: true, teacherId: true },
    });
  }

  async findTeacherStatus(teacherId: string) {
    const item = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { status: true },
    });
    return item?.status ?? null;
  }

  async findById(id: string) {
    const item = await this.prisma.payment.findUnique({ where: { id }, include });
    return item ? mapPayment(item) : null;
  }

  async findPage(query: PaymentQuery) {
    const terms = query.q?.split(/\s+/).filter(Boolean) ?? [];
    const where: Prisma.PaymentWhereInput = {
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentMethod ? { tenders: { some: { method: query.paymentMethod } } } : {}),
      ...(terms.length > 0
        ? {
            AND: terms.map((term) => ({
              OR: [
                { student: { firstName: { contains: term, mode: 'insensitive' as const } } },
                { student: { lastName: { contains: term, mode: 'insensitive' as const } } },
                { student: { dni: { contains: term.replace(/\D/g, '') || term } } },
              ],
            })),
          }
        : {}),
      ...(query.from || query.toExclusive
        ? {
            paidAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.toExclusive ? { lt: query.toExclusive } : {}),
            },
          }
        : {}),
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

  async confirmedTotal(studentId: string) {
    const aggregate = await this.prisma.payment.aggregate({
      where: { studentId, status: 'CONFIRMED' },
      _sum: { amount: true },
    });
    return aggregate._sum.amount?.toFixed(2) ?? '0.00';
  }

  async void(id: string, actorId: string, reason: string) {
    for (let attempt = 0; attempt < PAYMENT_TRANSACTION_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM payments WHERE id = ${id}::uuid FOR UPDATE`;
            const current = await tx.payment.findUnique({
              where: { id },
              include: { allocations: { select: { monthlyChargeId: true } }, tenders: true },
            });
            if (!current) throw new DomainError('PAYMENT_NOT_FOUND', 'Pago no encontrado');
            if (current.status === 'VOID')
              throw new DomainError('PAYMENT_ALREADY_VOID', 'El pago ya está anulado');
            const collections = await tx.cashMovement.findMany({
              where: { sourcePaymentId: id, type: 'COLLECTION' },
              orderBy: [{ cashShiftId: 'asc' }, { id: 'asc' }],
            });
            const shiftIds = [...new Set(collections.map(({ cashShiftId }) => cashShiftId))];
            if (shiftIds.length > 0)
              await tx.$queryRaw`SELECT id FROM cash_shifts WHERE id IN (${Prisma.join(shiftIds.map((shiftId) => Prisma.sql`${shiftId}::uuid`))}) ORDER BY id FOR UPDATE`;
            const chargeIds = [
              ...new Set(current.allocations.map(({ monthlyChargeId }) => monthlyChargeId)),
            ].sort();
            // Un cobro de otro concepto no tiene cuotas que bloquear (IN () sería inválido).
            if (chargeIds.length > 0)
              await tx.$queryRaw`SELECT id FROM monthly_charges WHERE id IN (${Prisma.join(chargeIds.map((chargeId) => Prisma.sql`${chargeId}::uuid`))}) ORDER BY id FOR UPDATE`;
            await tx.payment.update({
              where: { id },
              data: { status: 'VOID', voidedAt: new Date(), voidedByUserId: actorId },
            });
            if (collections.length > 0)
              await tx.cashMovement.createMany({
                data: collections.map((collection) => ({
                  cashShiftId: collection.cashShiftId,
                  type: 'REVERSAL',
                  method: collection.method,
                  amount: collection.amount,
                  sourcePaymentId: collection.sourcePaymentId,
                  sourcePaymentTenderId: collection.sourcePaymentTenderId,
                  reversalOfId: collection.id,
                  actorUserId: actorId,
                  reason,
                })),
              });
            const charges = await tx.monthlyCharge.findMany({
              where: { id: { in: chargeIds } },
              include: {
                adjustments: true,
                allocations: {
                  where: { payment: { status: 'CONFIRMED' } },
                  select: { amount: true },
                },
              },
            });
            for (const charge of charges) {
              if (charge.status === 'VOID') continue;
              await tx.monthlyCharge.update({
                where: { id: charge.id },
                data: {
                  status: paymentChargeStatus(
                    confirmedAllocatedAmount(charge.allocations),
                    adjustedAmounts(charge.baseAmount, charge.adjustments).studentDue,
                  ),
                },
              });
            }
            const updated = await tx.payment.findUniqueOrThrow({ where: { id }, include });
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
                  tenders: current.tenders.map((tender) => ({
                    method: tender.method,
                    amount: tender.amount.toFixed(2),
                  })),
                },
              },
            });
            return mapPayment(updated);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryableTransactionError(error)) {
          if (attempt < PAYMENT_TRANSACTION_ATTEMPTS - 1) {
            await waitBeforeRetry(attempt);
            continue;
          }
          throw new DomainError(
            'PAYMENT_CONCURRENCY_CONFLICT',
            'El pago fue modificado al mismo tiempo.',
          );
        }
        throw error;
      }
    }
    throw new DomainError(
      'PAYMENT_CONCURRENCY_CONFLICT',
      'El pago fue modificado al mismo tiempo.',
    );
  }
}
