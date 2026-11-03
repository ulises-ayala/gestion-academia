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
  buildReallocationPlan,
  confirmedAllocatedAmount,
  netAllocations,
  paymentChargeStatus,
} from '../domain/payment-allocation';
import { adjustedAmounts, lateFeeAdjustment, lateFeeApplies } from '../domain/billing-adjustments';
import { businessDayAt } from '../../dashboard/application/business-day';
import {
  allocatableAmount,
  assertRefundFits,
  buildCreditApplicationPlan,
  paymentCredit,
} from '../domain/payment-credit';

const include = {
  student: { select: { id: true, dni: true, firstName: true, lastName: true, phone: true } },
  createdBy: { select: { id: true, username: true } },
  voidedBy: { select: { id: true, username: true } },
  academicClass: { select: { id: true, name: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
  correctedBy: { select: { id: true } },
  catalogConcept: { select: { id: true, name: true } },
  cardSurcharge: { select: { id: true, amount: true, status: true } },
  tenders: { orderBy: [{ method: 'asc' as const }, { id: 'asc' as const }] },
  refunds: { select: { amount: true } },
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
  walkIn: item.walkInName
    ? { name: item.walkInName, phone: item.walkInPhone, dni: item.walkInDni }
    : null,
  amount: item.amount.toFixed(2),
  // Saldo a favor: lo cobrado que no quedó imputado a cuotas ni se devolvió.
  creditAmount:
    item.kind === 'CHARGES' && item.status === 'CONFIRMED'
      ? paymentCredit(item.amount, item.allocations, item.refunds).toFixed(2)
      : '0.00',
  refundedAmount: item.refunds
    .reduce((sum, refund) => sum.plus(refund.amount), new Prisma.Decimal(0))
    .toFixed(2),
  tenders: item.tenders.map((tender) => ({
    id: tender.id,
    method: tender.method,
    amount: tender.amount.toFixed(2),
  })),
  status: item.status,
  paidAt: item.paidAt.toISOString(),
  createdBy: item.createdBy,
  correctionOfId: item.correctionOfId,
  correctedById: item.correctedBy?.id ?? null,
  cardSurcharge:
    item.cardSurcharge?.status === 'CONFIRMED'
      ? { id: item.cardSurcharge.id, amount: item.cardSurcharge.amount.toFixed(2) }
      : null,
  surchargeOfId: item.surchargeOfId,
  voidedAt: item.voidedAt?.toISOString() ?? null,
  voidedBy: item.voidedBy,
  allocations: netAllocations(item.allocations).map(({ monthlyCharge, amount }) => ({
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
          // APPAREL y GALA_SEAL son legado: la migración los pasó al catálogo.
          concept: item.concept as OtherPaymentConceptDto,
          catalogConcept: item.catalogConcept,
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
    paidAt?: Date,
    monthlyChargeIds?: readonly string[],
    cardSurcharge?: string,
    allowCredit = false,
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
            const timeZone = process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires';
            // El recargo se decide con la fecha real del pago (un pago cargado tarde no lo genera).
            const today = businessDayAt(paidAt ?? new Date(), timeZone).dateValue;
            for (const charge of lockedCharges) {
              const paid = confirmedAllocatedAmount(charge.allocations);
              const due = adjustedAmounts(charge.baseAmount, charge.adjustments).studentDue;
              if (
                lateFeeApplies(
                  {
                    kind: charge.kind,
                    dueDate: charge.dueDate,
                    createdOn: businessDayAt(charge.createdAt, timeZone).dateValue,
                    hasLateFee: charge.adjustments.some(({ type }) => type === 'LATE_FEE'),
                    outstanding: due.minus(paid),
                  },
                  today,
                )
              )
                await tx.monthlyChargeAdjustment.create({ data: lateFeeAdjustment(charge.id) });
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
            // Cuotas elegidas por Administración: se imputa solo a esas, de la más vieja a la más nueva.
            const selected = monthlyChargeIds
              ? charges.filter(({ id }) => monthlyChargeIds.includes(id))
              : charges;
            if (monthlyChargeIds && selected.length !== monthlyChargeIds.length)
              throw new DomainError(
                'MONTHLY_CHARGE_NOT_FOUND',
                'Una de las cuotas elegidas no es del alumno o está anulada',
              );
            const plan = buildPaymentAllocationPlan(selected, amount);
            const { allocations, balances, totalOutstanding } = plan;
            // Con allowCredit, lo que supera la deuda queda como saldo a favor del pago.
            if (amount.greaterThan(totalOutstanding) && !allowCredit)
              throw new DomainError(
                'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE',
                monthlyChargeIds
                  ? 'El cobro supera lo que deben las cuotas elegidas'
                  : 'El cobro supera la deuda pendiente actual del alumno',
                { outstandingAmount: totalOutstanding.toFixed(2) },
              );
            if (!allowCredit && (!plan.remaining.isZero() || allocations.length === 0))
              throw new DomainError(
                'PAYMENT_NO_OUTSTANDING_BALANCE',
                'El alumno no tiene deuda pendiente',
              );
            const payment = await tx.payment.create({
              data: {
                studentId,
                amount,
                ...(paidAt ? { paidAt } : {}),
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
            // Recargo por tarjeta: otro cobro de la academia, pagado con tarjeta, en el mismo turno.
            if (cardSurcharge) {
              const surcharge = await tx.payment.create({
                data: {
                  studentId,
                  amount: cardSurcharge,
                  kind: 'OTHER',
                  concept: 'CARD_SURCHARGE',
                  surchargeOfId: payment.id,
                  ...(paidAt ? { paidAt } : {}),
                  createdByUserId: actorId,
                  tenders: { create: [{ method: 'CARD', amount: cardSurcharge }] },
                },
                include: { tenders: true },
              });
              await tx.cashMovement.create({
                data: {
                  cashShiftId: cashShift.id,
                  type: 'COLLECTION',
                  method: 'CARD',
                  amount: cardSurcharge,
                  sourcePaymentId: surcharge.id,
                  sourcePaymentTenderId: surcharge.tenders[0]!.id,
                  actorUserId: actorId,
                },
              });
            }
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
            // Con recargo por tarjeta se relee el cobro para que lo traiga (recibo, comprobante).
            return mapPayment(
              cardSurcharge
                ? await tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include })
                : payment,
            );
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
      studentId: string | null;
      walkIn: Readonly<{ name: string; phone: string | null; dni: string | null }> | null;
      concept: OtherPaymentConceptDto;
      conceptId: string | null;
      classId: string | null;
      teacherId: string | null;
      detail: string | null;
    }>,
    tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[],
    actorId: string,
    paidAt?: Date,
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
            walkInName: data.walkIn?.name ?? null,
            walkInPhone: data.walkIn?.phone ?? null,
            walkInDni: data.walkIn?.dni ?? null,
            amount,
            ...(paidAt ? { paidAt } : {}),
            kind: 'OTHER',
            concept: data.concept,
            conceptId: data.conceptId,
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
              conceptId: data.conceptId,
              detail: data.detail,
              classId: data.classId,
              teacherId: data.teacherId,
              amount: amount.toFixed(2),
              tenders: tenders.map((tender) => ({ method: tender.method, amount: tender.amount })),
            },
            metadata: { studentId: data.studentId, walkIn: data.walkIn },
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

  findConcept(conceptId: string) {
    return this.prisma.paymentConcept.findUnique({
      where: { id: conceptId },
      select: { status: true, requiresDetail: true },
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
                { walkInName: { contains: term, mode: 'insensitive' as const } },
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
              include: {
                allocations: { select: { monthlyChargeId: true } },
                tenders: true,
                refunds: { select: { id: true } },
                cardSurcharge: { select: { id: true, status: true } },
              },
            });
            if (!current) throw new DomainError('PAYMENT_NOT_FOUND', 'Pago no encontrado');
            if (current.status === 'VOID')
              throw new DomainError('PAYMENT_ALREADY_VOID', 'El pago ya está anulado');
            if (current.refunds.length > 0)
              throw new DomainError(
                'PAYMENT_REFUND_CONFLICT',
                'El pago tiene devoluciones de saldo a favor: no se puede anular ni corregir.',
              );
            // El recargo por tarjeta del cobro se anula con él (mismo turno, mismo motivo).
            const surchargeId =
              current.cardSurcharge?.status === 'CONFIRMED' ? current.cardSurcharge.id : null;
            const voidedIds = surchargeId ? [id, surchargeId] : [id];
            const collections = await tx.cashMovement.findMany({
              where: { sourcePaymentId: { in: voidedIds }, type: 'COLLECTION' },
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
            await tx.payment.updateMany({
              where: { id: { in: voidedIds } },
              data: { status: 'VOID', voidedAt: new Date(), voidedByUserId: actorId },
            });
            if (surchargeId)
              await tx.auditLog.create({
                data: {
                  actorUserId: actorId,
                  action: 'VOID',
                  entityType: 'PAYMENT',
                  entityId: surchargeId,
                  reason,
                  before: { status: 'CONFIRMED' },
                  after: { status: 'VOID' },
                  metadata: { source: 'CARD_SURCHARGE_OF', paymentId: id },
                },
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

  async correct(
    id: string,
    input: Readonly<{
      tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[];
      paidAt: Date;
    }>,
    actorId: string,
    reason: string,
  ) {
    for (let attempt = 0; attempt < PAYMENT_TRANSACTION_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM payments WHERE id = ${id}::uuid FOR UPDATE`;
            const original = await tx.payment.findUnique({
              where: { id },
              include: { allocations: true, tenders: true, refunds: { select: { id: true } } },
            });
            if (!original) throw new DomainError('PAYMENT_NOT_FOUND', 'Pago no encontrado');
            if (original.status === 'VOID')
              throw new DomainError('PAYMENT_ALREADY_VOID', 'El pago ya está anulado');
            if (original.refunds.length > 0)
              throw new DomainError(
                'PAYMENT_REFUND_CONFLICT',
                'El pago tiene devoluciones de saldo a favor: no se puede anular ni corregir.',
              );
            // La clase suelta de un alumno eventual no tiene alumno ni cuotas que bloquear.
            const studentId = original.studentId;
            if (studentId)
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`;
            const collections = await tx.cashMovement.findMany({
              where: { sourcePaymentId: id, type: 'COLLECTION' },
              orderBy: [{ cashShiftId: 'asc' }, { id: 'asc' }],
            });
            // Un cobro de caja tiene sus movimientos en un solo turno; los importados, ninguno.
            const shiftId = collections[0]?.cashShiftId ?? null;
            if (shiftId)
              await tx.$queryRaw`SELECT id FROM cash_shifts WHERE id = ${shiftId}::uuid FOR UPDATE`;
            if (studentId)
              await tx.$queryRaw`SELECT id FROM monthly_charges WHERE student_id = ${studentId}::uuid AND status <> 'VOID' ORDER BY due_date, created_at, id FOR UPDATE`;

            // 1. El original queda anulado, con la reversa de sus cobros en su turno.
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

            // 2. Imputación del reemplazo: con el mismo importe, las mismas cuotas; si cambia,
            //    de la cuota más vieja a la más nueva, como cualquier cobro.
            const amount = input.tenders.reduce(
              (sum, tender) => sum.plus(tender.amount),
              new Prisma.Decimal(0),
            );
            let allocations: { monthlyChargeId: string; amount: Prisma.Decimal }[] = [];
            if (original.kind === 'CHARGES' && studentId) {
              if (amount.equals(original.amount))
                allocations = netAllocations(original.allocations).map((allocation) => ({
                  monthlyChargeId: allocation.monthlyChargeId,
                  amount: allocation.amount,
                }));
              else {
                const charges = await tx.monthlyCharge.findMany({
                  where: { studentId, status: { not: 'VOID' } },
                  include: {
                    adjustments: true,
                    allocations: {
                      where: { payment: { status: 'CONFIRMED' } },
                      select: { amount: true },
                    },
                  },
                });
                const plan = buildPaymentAllocationPlan(
                  charges.map((charge) => ({
                    ...charge,
                    studentDueAmount: adjustedAmounts(charge.baseAmount, charge.adjustments)
                      .studentDue,
                  })),
                  amount,
                );
                if (amount.greaterThan(plan.totalOutstanding))
                  throw new DomainError(
                    'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE',
                    'El importe corregido supera la deuda del alumno',
                    { outstandingAmount: plan.totalOutstanding.toFixed(2) },
                  );
                allocations = plan.allocations;
              }
            }

            const replacement = await tx.payment.create({
              data: {
                studentId,
                walkInName: original.walkInName,
                walkInPhone: original.walkInPhone,
                walkInDni: original.walkInDni,
                amount,
                origin: original.origin,
                kind: original.kind,
                concept: original.concept,
                conceptDetail: original.conceptDetail,
                classId: original.classId,
                teacherId: original.teacherId,
                paidAt: input.paidAt,
                // Quien cobró sigue siendo quien registró el original; la corrección queda auditada.
                createdByUserId: original.createdByUserId,
                correctionOfId: original.id,
                tenders: {
                  create: input.tenders.map((tender) => ({
                    method: tender.method,
                    amount: tender.amount,
                  })),
                },
                allocations: { create: allocations },
              },
              include: { tenders: true },
            });
            await tx.payment.updateMany({
              where: { surchargeOfId: original.id },
              data: { surchargeOfId: replacement.id },
            });
            if (shiftId)
              await tx.cashMovement.createMany({
                data: replacement.tenders.map((tender) => ({
                  cashShiftId: shiftId,
                  type: 'COLLECTION',
                  method: tender.method,
                  amount: tender.amount,
                  sourcePaymentId: replacement.id,
                  sourcePaymentTenderId: tender.id,
                  actorUserId: actorId,
                  reason,
                })),
              });

            // 3. Estado de las cuotas que tocaban el original o el reemplazo.
            const chargeIds = [
              ...new Set([
                ...original.allocations.map(({ monthlyChargeId }) => monthlyChargeId),
                ...allocations.map(({ monthlyChargeId }) => monthlyChargeId),
              ]),
            ];
            const touched = await tx.monthlyCharge.findMany({
              where: { id: { in: chargeIds } },
              include: {
                adjustments: true,
                allocations: {
                  where: { payment: { status: 'CONFIRMED' } },
                  select: { amount: true },
                },
              },
            });
            for (const charge of touched) {
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

            const tenderSummary = (
              tenders: readonly { method: string; amount: Prisma.Decimal | string }[],
            ) =>
              tenders.map((tender) => ({
                method: tender.method,
                amount: new Prisma.Decimal(tender.amount).toFixed(2),
              }));
            await tx.auditLog.create({
              data: {
                actorUserId: actorId,
                action: 'CORRECTION',
                entityType: 'PAYMENT',
                entityId: original.id,
                reason,
                before: {
                  amount: original.amount.toFixed(2),
                  tenders: tenderSummary(original.tenders),
                  paidAt: original.paidAt.toISOString(),
                },
                after: {
                  paymentId: replacement.id,
                  amount: amount.toFixed(2),
                  tenders: tenderSummary(input.tenders),
                  paidAt: input.paidAt.toISOString(),
                },
                metadata: { source: 'PAYMENT_CORRECTION', studentId },
              },
            });
            return mapPayment(
              await tx.payment.findUniqueOrThrow({ where: { id: replacement.id }, include }),
            );
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

  async reallocate(
    id: string,
    target: readonly Readonly<{ monthlyChargeId: string; amount: string }>[],
    actorId: string,
    reason: string,
  ) {
    for (let attempt = 0; attempt < PAYMENT_TRANSACTION_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM payments WHERE id = ${id}::uuid FOR UPDATE`;
            const payment = await tx.payment.findUnique({
              where: { id },
              include: { allocations: true, refunds: { select: { amount: true } } },
            });
            if (!payment) throw new DomainError('PAYMENT_NOT_FOUND', 'Pago no encontrado');
            if (payment.status === 'VOID')
              throw new DomainError('PAYMENT_ALREADY_VOID', 'El pago ya está anulado');
            // Un cobro de cuotas siempre tiene alumno (payments_payer_check).
            if (payment.kind !== 'CHARGES' || !payment.studentId)
              throw new DomainError('VALIDATION_ERROR', 'Este cobro no se imputa a cuotas', {
                field: 'allocations',
              });
            const studentId = payment.studentId;
            // Mismo bloqueo por alumno que el cobro: la deuda no cambia mientras se reimputa.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`;
            await tx.$queryRaw`SELECT id FROM monthly_charges WHERE student_id = ${studentId}::uuid AND status <> 'VOID' ORDER BY due_date, created_at, id FOR UPDATE`;
            const charges = await tx.monthlyCharge.findMany({
              where: { studentId, status: { not: 'VOID' } },
              include: {
                adjustments: true,
                allocations: {
                  where: { payment: { status: 'CONFIRMED' } },
                  select: { amount: true },
                },
              },
            });
            const current = netAllocations(payment.allocations);
            const rows = buildReallocationPlan(
              allocatableAmount(payment.amount, payment.refunds),
              current,
              target.map((row) => ({
                monthlyChargeId: row.monthlyChargeId,
                amount: new Prisma.Decimal(row.amount),
              })),
              charges.map((charge) => ({
                id: charge.id,
                studentDueAmount: adjustedAmounts(charge.baseAmount, charge.adjustments).studentDue,
                paid: confirmedAllocatedAmount(charge.allocations),
              })),
            );
            await tx.paymentReallocation.create({
              data: {
                paymentId: id,
                reason,
                createdByUserId: actorId,
                allocations: {
                  create: rows.map((row) => ({
                    paymentId: id,
                    monthlyChargeId: row.monthlyChargeId,
                    amount: row.amount,
                  })),
                },
              },
            });
            const touched = await tx.monthlyCharge.findMany({
              where: { id: { in: rows.map(({ monthlyChargeId }) => monthlyChargeId) } },
              include: {
                adjustments: true,
                allocations: {
                  where: { payment: { status: 'CONFIRMED' } },
                  select: { amount: true },
                },
              },
            });
            for (const charge of touched) {
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
            await tx.auditLog.create({
              data: {
                actorUserId: actorId,
                action: 'UPDATE',
                entityType: 'PAYMENT',
                entityId: id,
                reason,
                before: {
                  allocations: current.map((row) => ({
                    monthlyChargeId: row.monthlyChargeId,
                    amount: row.amount.toFixed(2),
                  })),
                },
                after: {
                  allocations: target.map((row) => ({
                    monthlyChargeId: row.monthlyChargeId,
                    amount: row.amount,
                  })),
                },
                metadata: { source: 'PAYMENT_REALLOCATION', studentId },
              },
            });
            return mapPayment(await tx.payment.findUniqueOrThrow({ where: { id }, include }));
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

  async refund(
    id: string,
    input: Readonly<{ amount: string; method: PaymentMethodDto; fromCashShift: boolean }>,
    actorId: string,
    reason: string,
  ) {
    for (let attempt = 0; attempt < PAYMENT_TRANSACTION_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM payments WHERE id = ${id}::uuid FOR UPDATE`;
            const payment = await tx.payment.findUnique({
              where: { id },
              include: { allocations: true, refunds: { select: { amount: true } } },
            });
            if (!payment) throw new DomainError('PAYMENT_NOT_FOUND', 'Pago no encontrado');
            if (payment.status === 'VOID')
              throw new DomainError('PAYMENT_ALREADY_VOID', 'El pago ya está anulado');
            if (payment.kind !== 'CHARGES' || !payment.studentId)
              throw new DomainError('PAYMENT_NO_CREDIT', 'Este cobro no tiene saldo a favor');
            // Mismo bloqueo por alumno que el cobro y la reimputación.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.studentId}))`;
            // Solo el efectivo que sale de la caja es un egreso del turno de quien la registra; lo
            // demás (Mercado Pago, transferencia, tarjeta o efectivo que guarda Dirección) queda
            // registrado fuera de la caja.
            let cashShift: { id: string } | null = null;
            if (input.fromCashShift) {
              [cashShift = null] = await tx.$queryRaw<readonly { id: string }[]>`
                SELECT id FROM cash_shifts
                WHERE user_id = ${actorId}::uuid AND status = 'OPEN'
                FOR UPDATE
              `;
              if (!cashShift)
                throw new DomainError(
                  'CASH_SHIFT_REQUIRED',
                  'Para devolver efectivo de la caja necesitás tu turno abierto.',
                );
            }
            const amount = new Prisma.Decimal(input.amount);
            const credit = paymentCredit(payment.amount, payment.allocations, payment.refunds);
            assertRefundFits(amount, credit);
            const refund = await tx.paymentRefund.create({
              data: {
                paymentId: id,
                amount,
                method: input.method,
                cashShiftId: cashShift?.id ?? null,
                reason,
                createdByUserId: actorId,
              },
            });
            if (cashShift)
              await tx.cashMovement.create({
                data: {
                  cashShiftId: cashShift.id,
                  type: 'REFUND',
                  method: input.method,
                  amount,
                  sourcePaymentId: id,
                  refundId: refund.id,
                  actorUserId: actorId,
                  reason,
                },
              });
            await tx.auditLog.create({
              data: {
                actorUserId: actorId,
                action: 'CREATE',
                entityType: 'PAYMENT_REFUND',
                entityId: refund.id,
                reason,
                after: { paymentId: id, amount: amount.toFixed(2), method: input.method },
                metadata: {
                  studentId: payment.studentId,
                  creditBefore: credit.toFixed(2),
                  cashShiftId: cashShift?.id ?? null,
                },
              },
            });
            return mapPayment(await tx.payment.findUniqueOrThrow({ where: { id }, include }));
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

  async applyCredit(studentId: string, actorId: string, reason: string) {
    for (let attempt = 0; attempt < PAYMENT_TRANSACTION_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // Mismo bloqueo por alumno que el cobro y la reimputación.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`;
            await tx.$queryRaw`SELECT id FROM monthly_charges WHERE student_id = ${studentId}::uuid AND status <> 'VOID' ORDER BY due_date, created_at, id FOR UPDATE`;
            const payments = await tx.payment.findMany({
              where: { studentId, status: 'CONFIRMED', kind: 'CHARGES' },
              include: { allocations: true, refunds: { select: { amount: true } } },
              orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
            });
            const charges = await tx.monthlyCharge.findMany({
              where: { studentId, status: { not: 'VOID' } },
              include: {
                adjustments: true,
                allocations: {
                  where: { payment: { status: 'CONFIRMED' } },
                  select: { amount: true },
                },
              },
            });
            const plan = buildCreditApplicationPlan(
              payments.map((payment) => ({
                paymentId: payment.id,
                credit: paymentCredit(payment.amount, payment.allocations, payment.refunds),
              })),
              charges.map((charge) => ({
                ...charge,
                studentDueAmount: adjustedAmounts(charge.baseAmount, charge.adjustments).studentDue,
              })),
            );
            for (const { paymentId, allocations } of plan) {
              await tx.paymentReallocation.create({
                data: {
                  paymentId,
                  reason,
                  createdByUserId: actorId,
                  allocations: { create: allocations.map((row) => ({ paymentId, ...row })) },
                },
              });
              await tx.auditLog.create({
                data: {
                  actorUserId: actorId,
                  action: 'UPDATE',
                  entityType: 'PAYMENT',
                  entityId: paymentId,
                  reason,
                  after: {
                    applied: allocations.map((row) => ({
                      monthlyChargeId: row.monthlyChargeId,
                      amount: row.amount.toFixed(2),
                    })),
                  },
                  metadata: { source: 'CREDIT_APPLICATION', studentId },
                },
              });
            }
            const touchedIds = [
              ...new Set(
                plan.flatMap(({ allocations }) => allocations.map((row) => row.monthlyChargeId)),
              ),
            ];
            const touched = await tx.monthlyCharge.findMany({
              where: { id: { in: touchedIds } },
              include: {
                adjustments: true,
                allocations: {
                  where: { payment: { status: 'CONFIRMED' } },
                  select: { amount: true },
                },
              },
            });
            for (const charge of touched)
              await tx.monthlyCharge.update({
                where: { id: charge.id },
                data: {
                  status: paymentChargeStatus(
                    confirmedAllocatedAmount(charge.allocations),
                    adjustedAmounts(charge.baseAmount, charge.adjustments).studentDue,
                  ),
                },
              });
            const applied = plan
              .flatMap(({ allocations }) => allocations)
              .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
            return { applied: applied.toFixed(2) };
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
            'La cuenta del alumno cambió al mismo tiempo.',
          );
        }
        throw error;
      }
    }
    throw new DomainError(
      'PAYMENT_CONCURRENCY_CONFLICT',
      'La cuenta del alumno cambió al mismo tiempo.',
    );
  }

  async creditTotal(studentId: string) {
    const [row] = await this.prisma.$queryRaw<readonly { credit: Prisma.Decimal | null }[]>`
      SELECT SUM(GREATEST(p.amount - COALESCE(a.allocated, 0) - COALESCE(r.refunded, 0), 0)) AS credit
      FROM payments p
      LEFT JOIN (
        SELECT payment_id, SUM(amount) AS allocated FROM payment_allocations GROUP BY payment_id
      ) a ON a.payment_id = p.id
      LEFT JOIN (
        SELECT payment_id, SUM(amount) AS refunded FROM payment_refunds GROUP BY payment_id
      ) r ON r.payment_id = p.id
      WHERE p.student_id = ${studentId}::uuid AND p.status = 'CONFIRMED' AND p.kind = 'CHARGES'
    `;
    return new Prisma.Decimal(row?.credit ?? 0).toFixed(2);
  }
}
