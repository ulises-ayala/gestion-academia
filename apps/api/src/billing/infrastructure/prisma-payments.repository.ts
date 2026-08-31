import type { PaymentDto, PaymentMethodDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import type { PaymentQuery, PaymentsRepository } from '../application/payments.repository';
import {
  buildPaymentAllocationPlan,
  confirmedAllocatedAmount,
  paymentChargeStatus,
} from '../domain/payment-allocation';

const include = {
  student: { select: { id: true, dni: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, username: true } },
  voidedBy: { select: { id: true, username: true } },
  tenders: { orderBy: [{ method: 'asc' as const }, { id: 'asc' as const }] },
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

  async create(
    studentId: string,
    tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[],
    actorId: string,
  ) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`;
            await tx.$queryRaw`SELECT id FROM monthly_charges WHERE student_id = ${studentId}::uuid AND status IN ('PENDING', 'PARTIAL') ORDER BY due_date, created_at, id FOR UPDATE`;
            const charges = await tx.monthlyCharge.findMany({
              where: { studentId, status: { in: ['PENDING', 'PARTIAL'] } },
              include: {
                allocations: {
                  where: { payment: { status: 'CONFIRMED' } },
                  select: { amount: true },
                },
              },
              orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
            });
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
            for (const allocation of allocations) {
              const balance = balances.find(
                ({ charge }) => charge.id === allocation.monthlyChargeId,
              )!;
              await tx.monthlyCharge.update({
                where: { id: balance.charge.id },
                data: {
                  status: paymentChargeStatus(
                    balance.paid.plus(allocation.amount),
                    balance.charge.finalAmount,
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
          if (attempt < 2) continue;
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

  async findById(id: string) {
    const item = await this.prisma.payment.findUnique({ where: { id }, include });
    return item ? mapPayment(item) : null;
  }

  async findPage(query: PaymentQuery) {
    const where: Prisma.PaymentWhereInput = {
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentMethod ? { tenders: { some: { method: query.paymentMethod } } } : {}),
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
    for (let attempt = 0; attempt < 3; attempt++) {
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
            const chargeIds = [
              ...new Set(current.allocations.map(({ monthlyChargeId }) => monthlyChargeId)),
            ].sort();
            await tx.$queryRaw`SELECT id FROM monthly_charges WHERE id IN (${Prisma.join(chargeIds.map((chargeId) => Prisma.sql`${chargeId}::uuid`))}) ORDER BY id FOR UPDATE`;
            await tx.payment.update({
              where: { id },
              data: { status: 'VOID', voidedAt: new Date(), voidedByUserId: actorId },
            });
            const charges = await tx.monthlyCharge.findMany({
              where: { id: { in: chargeIds } },
              include: {
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
                    charge.finalAmount,
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
          if (attempt < 2) continue;
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
