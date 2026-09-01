import type {
  CreateEnrollmentBillingConditionDto,
  EndEnrollmentBillingConditionDto,
  EnrollmentBillingConditionDto,
} from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import {
  adjustedAmounts,
  chargeStatus,
  conditionDeltas,
  parseBillingPeriod,
  validateCondition,
} from '../domain/billing-adjustments';

const conditionInclude = {
  teacher: { select: { id: true, firstName: true, lastName: true } },
  authorizedBy: { select: { id: true, username: true } },
};
const isoPeriod = (date: Date) => date.toISOString().slice(0, 7);
const mapCondition = (item: any): EnrollmentBillingConditionDto => ({
  id: item.id,
  enrollmentId: item.enrollmentId,
  type: item.type,
  calculation: item.calculation,
  configuredValue: item.configuredValue.toFixed(2),
  effectiveFrom: isoPeriod(item.effectiveFrom),
  effectiveUntil: item.effectiveUntil ? isoPeriod(item.effectiveUntil) : null,
  teacher: item.teacher,
  authorizedBy: item.authorizedBy,
  reason: item.reason,
  endedAt: item.endedAt?.toISOString() ?? null,
  endReason: item.endReason,
  renewedFromId: item.renewedFromId,
  createdAt: item.createdAt.toISOString(),
});
const reason = (value: string) => {
  const normalized = value?.trim();
  if (!normalized || normalized.length > 500)
    throw new DomainError('VALIDATION_ERROR', 'El motivo es obligatorio (mÃ¡ximo 500 caracteres)', {
      field: 'reason',
    });
  return normalized;
};

@Injectable()
export class BillingAdjustmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(enrollmentId: string) {
    return (
      await this.prisma.enrollmentBillingCondition.findMany({
        where: { enrollmentId },
        include: conditionInclude,
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      })
    ).map(mapCondition);
  }

  async create(
    enrollmentId: string,
    input: CreateEnrollmentBillingConditionDto,
    actor: PublicAuthUser,
    renewedFromId?: string,
  ) {
    if (actor.role === 'RECEPTION')
      throw new DomainError('FORBIDDEN', 'Admisión solo puede consultar ajustes de facturación');
    if (input.type === 'DIRECTION_SCHOLARSHIP' && actor.role !== 'ADMINISTRATOR')
      throw new DomainError('FORBIDDEN', 'Solo Dirección puede autorizar esta beca');
    const validated = validateCondition(input);
    const effectiveFrom = parseBillingPeriod(input.effectiveFrom);
    const effectiveUntil = input.effectiveUntil
      ? parseBillingPeriod(input.effectiveUntil, 'effectiveUntil')
      : null;
    if (effectiveUntil && effectiveUntil < effectiveFrom)
      throw new DomainError(
        'VALIDATION_ERROR',
        'La vigencia final no puede ser anterior al inicio',
      );
    return this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findUnique({
        where: { id: enrollmentId },
        include: { class: { select: { teacherId: true } } },
      });
      if (!enrollment) throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada');
      const teacherId = input.type === 'DIRECTION_SCHOLARSHIP' ? null : (input.teacherId ?? null);
      if (
        input.type !== 'DIRECTION_SCHOLARSHIP' &&
        (!teacherId || teacherId !== enrollment.class.teacherId)
      )
        throw new DomainError(
          'BILLING_TEACHER_NOT_ASSIGNED',
          'El docente debe ser el asignado a la actividad de esta inscripción',
        );
      const condition = await tx.enrollmentBillingCondition.create({
        data: {
          enrollmentId,
          type: input.type,
          calculation: validated.calculation,
          configuredValue: validated.configuredValue,
          effectiveFrom,
          effectiveUntil,
          teacherId,
          authorizedByUserId: input.type === 'DIRECTION_SCHOLARSHIP' ? actor.id : null,
          createdByUserId: actor.id,
          reason: reason(input.reason),
          ...(renewedFromId ? { renewedFromId } : {}),
        },
        include: conditionInclude,
      });
      const charges = await tx.monthlyCharge.findMany({
        where: {
          enrollmentId,
          status: { in: ['PENDING', 'PARTIAL'] },
          period: { gte: effectiveFrom, ...(effectiveUntil ? { lte: effectiveUntil } : {}) },
        },
        include: {
          adjustments: true,
          allocations: { where: { payment: { status: 'CONFIRMED' } }, select: { amount: true } },
        },
      });
      for (const charge of charges) {
        const deltas = conditionDeltas(charge.baseAmount, condition);
        const next = adjustedAmounts(charge.baseAmount, [...charge.adjustments, deltas]);
        const paid = charge.allocations.reduce(
          (sum, row) => sum.plus(row.amount),
          new Prisma.Decimal(0),
        );
        if (paid.greaterThan(next.studentDue))
          throw new DomainError(
            'ADJUSTMENT_WOULD_CREATE_CREDIT',
            'El ajuste dejaría un pago mayor que la deuda de una cuota existente',
            {
              monthlyChargeId: charge.id,
              paidAmount: paid.toFixed(2),
              studentDueAmount: next.studentDue.toFixed(2),
            },
          );
        await tx.monthlyChargeAdjustment.create({
          data: {
            monthlyChargeId: charge.id,
            sourceConditionId: condition.id,
            type: condition.type,
            calculation: condition.calculation,
            configuredValue: condition.configuredValue,
            ...deltas,
            teacherId: condition.teacherId,
            authorizedByUserId: condition.authorizedByUserId,
            createdByUserId: actor.id,
            reason: condition.reason,
          },
        });
        await tx.monthlyCharge.update({
          where: { id: charge.id },
          data: { status: chargeStatus(paid, next.studentDue) },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: renewedFromId ? 'RENEW' : 'CREATE',
          entityType: 'BILLING_CONDITION',
          entityId: condition.id,
          reason: condition.reason,
          after: {
            enrollmentId,
            type: condition.type,
            calculation: condition.calculation,
            configuredValue: condition.configuredValue.toFixed(2),
            effectiveFrom: isoPeriod(effectiveFrom),
            effectiveUntil: effectiveUntil ? isoPeriod(effectiveUntil) : null,
            teacherId,
          },
          metadata: { affectedChargeIds: charges.map(({ id }) => id), renewedFromId },
        },
      });
      return mapCondition(condition);
    });
  }

  async end(id: string, input: EndEnrollmentBillingConditionDto, actor: PublicAuthUser) {
    if (actor.role === 'RECEPTION') throw new DomainError('FORBIDDEN', 'Acción no permitida');
    const effectiveUntil = parseBillingPeriod(input.effectiveUntil, 'effectiveUntil');
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.enrollmentBillingCondition.findUnique({ where: { id } });
      if (!current) throw new DomainError('BILLING_CONDITION_NOT_FOUND', 'Condición no encontrada');
      if (current.endedAt)
        throw new DomainError('BILLING_CONDITION_ALREADY_ENDED', 'La condición ya finalizó');
      if (effectiveUntil < current.effectiveFrom)
        throw new DomainError(
          'VALIDATION_ERROR',
          'La vigencia final no puede ser anterior al inicio',
        );
      const updated = await tx.enrollmentBillingCondition.update({
        where: { id },
        data: {
          effectiveUntil,
          endedAt: new Date(),
          endedByUserId: actor.id,
          endReason: reason(input.reason),
        },
        include: conditionInclude,
      });
      const futureSnapshots = await tx.monthlyChargeAdjustment.findMany({
        where: {
          sourceConditionId: id,
          reversal: null,
          monthlyCharge: { period: { gt: effectiveUntil }, status: { not: 'VOID' } },
        },
        include: {
          monthlyCharge: {
            include: {
              adjustments: true,
              allocations: {
                where: { payment: { status: 'CONFIRMED' } },
                select: { amount: true },
              },
            },
          },
        },
      });
      for (const snapshot of futureSnapshots) {
        const reversal = await tx.monthlyChargeAdjustment.create({
          data: {
            monthlyChargeId: snapshot.monthlyChargeId,
            type: 'REVERSAL',
            effectiveAmount: snapshot.effectiveAmount,
            studentAmountDelta: snapshot.studentAmountDelta.negated(),
            settlementBaseDelta: snapshot.settlementBaseDelta.negated(),
            teacherId: snapshot.teacherId,
            authorizedByUserId: snapshot.authorizedByUserId,
            createdByUserId: actor.id,
            reason: updated.endReason,
            reversalOfId: snapshot.id,
          },
        });
        const due = adjustedAmounts(snapshot.monthlyCharge.baseAmount, [
          ...snapshot.monthlyCharge.adjustments,
          reversal,
        ]).studentDue;
        const paid = snapshot.monthlyCharge.allocations.reduce(
          (sum, row) => sum.plus(row.amount),
          new Prisma.Decimal(0),
        );
        await tx.monthlyCharge.update({
          where: { id: snapshot.monthlyChargeId },
          data: { status: chargeStatus(paid, due) },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'END',
          entityType: 'BILLING_CONDITION',
          entityId: id,
          reason: updated.endReason,
          before: {
            effectiveUntil: current.effectiveUntil ? isoPeriod(current.effectiveUntil) : null,
          },
          after: { effectiveUntil: isoPeriod(effectiveUntil) },
          metadata: {
            reversedChargeIds: futureSnapshots.map(({ monthlyChargeId }) => monthlyChargeId),
          },
        },
      });
      return mapCondition(updated);
    });
  }

  async renew(id: string, input: CreateEnrollmentBillingConditionDto, actor: PublicAuthUser) {
    const current = await this.prisma.enrollmentBillingCondition.findUnique({ where: { id } });
    if (!current) throw new DomainError('BILLING_CONDITION_NOT_FOUND', 'Condición no encontrada');
    return this.create(current.enrollmentId, input, actor, id);
  }

  async reverse(chargeId: string, adjustmentId: string, why: string, actor: PublicAuthUser) {
    if (actor.role === 'RECEPTION') throw new DomainError('FORBIDDEN', 'Acción no permitida');
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.monthlyChargeAdjustment.findFirst({
        where: { id: adjustmentId, monthlyChargeId: chargeId },
      });
      if (!original) throw new DomainError('CHARGE_ADJUSTMENT_NOT_FOUND', 'Ajuste no encontrado');
      if (original.type === 'DIRECTION_SCHOLARSHIP' && actor.role !== 'ADMINISTRATOR')
        throw new DomainError('FORBIDDEN', 'Solo Dirección puede corregir esta beca');
      if (original.type === 'REVERSAL')
        throw new DomainError('ADJUSTMENT_ALREADY_REVERSAL', 'No se puede revertir una reversa');
      const charge = await tx.monthlyCharge.findUniqueOrThrow({
        where: { id: chargeId },
        include: {
          adjustments: true,
          allocations: { where: { payment: { status: 'CONFIRMED' } }, select: { amount: true } },
        },
      });
      const reversal = await tx.monthlyChargeAdjustment.create({
        data: {
          monthlyChargeId: chargeId,
          type: 'REVERSAL',
          effectiveAmount: original.effectiveAmount,
          studentAmountDelta: original.studentAmountDelta.negated(),
          settlementBaseDelta: original.settlementBaseDelta.negated(),
          teacherId: original.teacherId,
          authorizedByUserId: original.authorizedByUserId,
          createdByUserId: actor.id,
          reason: reason(why),
          reversalOfId: original.id,
        },
      });
      const amounts = adjustedAmounts(charge.baseAmount, [...charge.adjustments, reversal]);
      const paid = charge.allocations.reduce(
        (sum, row) => sum.plus(row.amount),
        new Prisma.Decimal(0),
      );
      if (paid.greaterThan(amounts.studentDue))
        throw new DomainError('ADJUSTMENT_WOULD_CREATE_CREDIT', 'La reversa dejaría saldo a favor');
      await tx.monthlyCharge.update({
        where: { id: chargeId },
        data: { status: chargeStatus(paid, amounts.studentDue) },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'CORRECTION',
          entityType: 'MONTHLY_CHARGE_ADJUSTMENT',
          entityId: reversal.id,
          reason: reversal.reason,
          before: { adjustmentId: original.id },
          after: { reversalId: reversal.id },
          metadata: { monthlyChargeId: chargeId },
        },
      });
      return { id: reversal.id };
    });
  }
}
