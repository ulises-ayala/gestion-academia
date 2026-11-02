import type {
  ClassSettlementOverviewDto,
  ClassSettlementPlanDto,
  SaveClassSettlementPlanDto,
  SettlementDto,
} from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { businessDayAt } from '../../dashboard/application/business-day';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import { parseBillingPeriod } from '../../billing/domain/billing-adjustments';
import { toCsv } from '../../reports/domain/csv';
import {
  computeSettlement,
  validateShares,
  type ChargeIncome,
  type SettlementPlan,
  type SingleClassIncome,
} from '../domain/settlement';

const timeZone = () => process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires';
const isoPeriod = (date: Date) => date.toISOString().slice(0, 7);
const nextPeriod = (period: string) => {
  const date = new Date(`${period}-01T12:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return isoPeriod(date);
};
const zero = () => new Prisma.Decimal(0);
const conceptLabels = {
  MONTHLY: 'Cuota',
  HISTORICAL_DEBT: 'Deuda anterior',
  SINGLE_CLASS: 'Clase suelta',
} as const;

const planInclude = {
  shares: {
    include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [
      { teacher: { lastName: 'asc' as const } },
      { teacher: { firstName: 'asc' as const } },
    ],
  },
  createdBy: { select: { id: true, username: true } },
} satisfies Prisma.ClassSettlementPlanInclude;
type IncludedPlan = Prisma.ClassSettlementPlanGetPayload<{ include: typeof planInclude }>;
const mapPlan = (plan: IncludedPlan): ClassSettlementPlanDto => {
  const shared = plan.shares.reduce((sum, share) => sum.plus(share.percentage), zero());
  return {
    id: plan.id,
    classId: plan.classId,
    validFrom: isoPeriod(plan.validFrom),
    reason: plan.reason,
    shares: plan.shares.map((share) => ({
      teacher: share.teacher,
      percentage: share.percentage.toFixed(2),
    })),
    academyPercentage: new Prisma.Decimal(100).minus(shared).toFixed(2),
    createdBy: plan.createdBy,
    createdAt: plan.createdAt.toISOString(),
  };
};

type ChargeRow = {
  paymentId: string;
  paidAt: Date;
  studentName: string;
  classId: string;
  className: string;
  chargeKind: 'MONTHLY' | 'HISTORICAL_DEBT';
  chargePeriod: string;
  collected: Prisma.Decimal;
  baseAmount: Prisma.Decimal;
  studentDelta: Prisma.Decimal;
  settlementDelta: Prisma.Decimal;
};
type SingleClassRow = Omit<SingleClassIncome, 'collected'> & { collected: Prisma.Decimal };

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mes en curso (AAAA-MM) según la fecha de negocio. */
  private currentPeriod() {
    return businessDayAt(new Date(), timeZone()).date.slice(0, 7);
  }

  private monthRange(period: string) {
    return {
      from: businessDayAt(new Date(`${period}-01T12:00:00.000Z`), timeZone()).start,
      to: businessDayAt(new Date(`${nextPeriod(period)}-01T12:00:00.000Z`), timeZone()).start,
    };
  }

  /** Liquidación del mes: la guardada si Dirección la cerró, o calculada con los cobros de hoy. */
  async get(periodValue: string): Promise<SettlementDto> {
    const period = isoPeriod(parseBillingPeriod(periodValue, 'period'));
    const closing = await this.prisma.settlementClosing.findUnique({
      where: { period: new Date(`${period}-01T00:00:00.000Z`) },
      include: { closedBy: { select: { id: true, username: true } } },
    });
    if (closing)
      return {
        ...(closing.snapshot as unknown as SettlementDto),
        status: 'CLOSED',
        canClose: false,
        closedAt: closing.closedAt.toISOString(),
        closedBy: closing.closedBy,
        note: closing.note,
      };
    return this.compute(period);
  }

  private async compute(period: string): Promise<SettlementDto> {
    const { from, to } = this.monthRange(period);
    const [chargeRows, singleRows, other, plans] = await Promise.all([
      this.prisma.$queryRaw<ChargeRow[]>(Prisma.sql`
        SELECT p.id AS "paymentId", p.paid_at AS "paidAt",
          CONCAT(s.first_name, ' ', s.last_name) AS "studentName",
          c.id AS "classId", c.name AS "className", mc.kind::text AS "chargeKind",
          TO_CHAR(mc.period, 'YYYY-MM') AS "chargePeriod", pa.amount AS collected,
          mc.base_amount AS "baseAmount",
          COALESCE(adj.student_delta, 0) AS "studentDelta",
          COALESCE(adj.settlement_delta, 0) AS "settlementDelta"
        FROM payment_allocations pa
        JOIN payments p ON p.id = pa.payment_id
        JOIN monthly_charges mc ON mc.id = pa.monthly_charge_id
        JOIN enrollments e ON e.id = mc.enrollment_id
        JOIN classes c ON c.id = e.class_id
        JOIN students s ON s.id = p.student_id
        LEFT JOIN (
          SELECT monthly_charge_id, SUM(student_amount_delta) AS student_delta,
            SUM(settlement_base_delta) AS settlement_delta
          FROM monthly_charge_adjustments GROUP BY monthly_charge_id
        ) adj ON adj.monthly_charge_id = mc.id
        WHERE p.status = 'CONFIRMED' AND p.paid_at >= ${from} AND p.paid_at < ${to}
        ORDER BY p.paid_at, p.id, c.name`),
      this.prisma.$queryRaw<SingleClassRow[]>(Prisma.sql`
        SELECT p.id AS "paymentId", p.paid_at AS "paidAt",
          CONCAT(s.first_name, ' ', s.last_name) AS "studentName",
          c.id AS "classId", c.name AS "className", p.teacher_id AS "teacherId",
          p.amount AS collected
        FROM payments p
        JOIN classes c ON c.id = p.class_id
        JOIN students s ON s.id = p.student_id
        WHERE p.status = 'CONFIRMED' AND p.concept = 'SINGLE_CLASS' AND p.teacher_id IS NOT NULL
          AND p.paid_at >= ${from} AND p.paid_at < ${to}
        ORDER BY p.paid_at, p.id`),
      this.prisma.payment.aggregate({
        where: {
          status: 'CONFIRMED',
          kind: 'OTHER',
          OR: [{ concept: null }, { concept: { not: 'SINGLE_CLASS' } }],
          paidAt: { gte: from, lt: to },
        },
        _sum: { amount: true },
      }),
      this.prisma.classSettlementPlan.findMany({ include: { shares: true } }),
    ]);
    const charges: ChargeIncome[] = chargeRows.map((row) => ({
      paymentId: row.paymentId,
      paidAt: row.paidAt,
      studentName: row.studentName,
      classId: row.classId,
      className: row.className,
      chargeKind: row.chargeKind,
      chargePeriod: row.chargePeriod,
      collected: new Prisma.Decimal(row.collected),
      studentDue: Prisma.Decimal.max(new Prisma.Decimal(row.baseAmount).plus(row.studentDelta), 0),
      settlementBase: Prisma.Decimal.max(
        new Prisma.Decimal(row.baseAmount).plus(row.settlementDelta),
        0,
      ),
    }));
    const settlementPlans: SettlementPlan[] = plans.map((plan) => ({
      classId: plan.classId,
      validFrom: isoPeriod(plan.validFrom),
      shares: plan.shares.map((share) => ({
        teacherId: share.teacherId,
        percentage: share.percentage,
      })),
    }));
    const result = computeSettlement({
      charges,
      singleClasses: singleRows.map((row) => ({
        ...row,
        collected: new Prisma.Decimal(row.collected),
      })),
      otherIncome: other._sum.amount ?? zero(),
      plans: settlementPlans,
      period,
    });
    const teachers = await this.prisma.teacher.findMany({
      where: { id: { in: result.teachers.map((item) => item.teacherId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
    return {
      period,
      status: 'OPEN',
      canClose: period < this.currentPeriod(),
      generatedAt: new Date().toISOString(),
      closedAt: null,
      closedBy: null,
      note: null,
      totals: {
        collected: result.collected.toFixed(2),
        classIncome: result.classIncome.toFixed(2),
        otherIncome: result.otherIncome.toFixed(2),
        teachers: result.teachersTotal.toFixed(2),
        academy: result.academy.toFixed(2),
      },
      teachers: result.teachers
        .map((item) => ({
          teacher: teacherById.get(item.teacherId) ?? {
            id: item.teacherId,
            firstName: 'Profesor',
            lastName: '',
          },
          total: item.total.toFixed(2),
          lines: item.lines.map((line) => ({
            paymentId: line.paymentId,
            paidAt: line.paidAt.toISOString(),
            studentName: line.studentName,
            className: line.className,
            concept: line.concept,
            chargePeriod: line.chargePeriod,
            collected: line.collected.toFixed(2),
            base: line.base.toFixed(2),
            percentage: line.percentage.toFixed(2),
            amount: line.amount.toFixed(2),
          })),
        }))
        .sort(
          (left, right) =>
            left.teacher.lastName.localeCompare(right.teacher.lastName, 'es') ||
            left.teacher.firstName.localeCompare(right.teacher.firstName, 'es'),
        ),
      unconfigured: result.unconfigured
        .map((item) => ({ ...item, collected: item.collected.toFixed(2) }))
        .sort((left, right) => left.className.localeCompare(right.className, 'es')),
    };
  }

  /** Dirección cierra un mes terminado: la liquidación queda guardada tal como está hoy. */
  async close(periodValue: string, noteValue: string | undefined, actor: PublicAuthUser) {
    const period = isoPeriod(parseBillingPeriod(periodValue, 'period'));
    if (period >= this.currentPeriod())
      throw new DomainError(
        'SETTLEMENT_MONTH_NOT_ENDED',
        'Solo se puede cerrar la liquidación de un mes terminado',
        { field: 'period' },
      );
    const note = noteValue?.trim() ? noteValue.trim().slice(0, 500) : null;
    const snapshot = await this.compute(period);
    try {
      await this.prisma.$transaction(async (tx) => {
        const closing = await tx.settlementClosing.create({
          data: {
            period: new Date(`${period}-01T00:00:00.000Z`),
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            note,
            closedByUserId: actor.id,
          },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: actor.id,
            action: 'CLOSE',
            entityType: 'SETTLEMENT',
            entityId: closing.id,
            reason: note,
            after: { period, ...snapshot.totals },
            metadata: { period },
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new DomainError('SETTLEMENT_CLOSED_CONFLICT', 'Esa liquidación ya está cerrada');
      throw error;
    }
    return this.get(period);
  }

  /** Reabrir un mes cerrado (para corregir algo): vuelve a calcularse con los cobros de hoy. */
  async reopen(periodValue: string, why: string | undefined, actor: PublicAuthUser) {
    const period = isoPeriod(parseBillingPeriod(periodValue, 'period'));
    const reason = why?.trim();
    if (!reason)
      throw new DomainError('VALIDATION_ERROR', 'El motivo es obligatorio', { field: 'reason' });
    await this.prisma.$transaction(async (tx) => {
      const closing = await tx.settlementClosing.findUnique({
        where: { period: new Date(`${period}-01T00:00:00.000Z`) },
      });
      if (!closing)
        throw new DomainError('SETTLEMENT_NOT_FOUND', 'Esa liquidación no está cerrada');
      await tx.settlementClosing.delete({ where: { id: closing.id } });
      const totals = (closing.snapshot as unknown as SettlementDto).totals;
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'OPEN',
          entityType: 'SETTLEMENT',
          entityId: closing.id,
          reason: reason.slice(0, 500),
          before: { period, ...totals, closedAt: closing.closedAt.toISOString() },
          metadata: { period },
        },
      });
    });
    return this.get(period);
  }

  async exportCsv(periodValue: string) {
    const settlement = await this.get(periodValue);
    const rows = settlement.teachers.flatMap((item) =>
      item.lines.map((line) => [
        `${item.teacher.firstName} ${item.teacher.lastName}`.trim(),
        line.paidAt.slice(0, 10),
        line.studentName,
        line.className,
        conceptLabels[line.concept],
        line.chargePeriod ?? '',
        line.collected,
        line.base,
        line.percentage,
        line.amount,
      ]),
    );
    const totals = settlement.teachers.map((item) => [
      `${item.teacher.firstName} ${item.teacher.lastName}`.trim(),
      '',
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      item.total,
    ]);
    return toCsv(
      [
        'Profesor',
        'Fecha de cobro',
        'Alumno',
        'Clase',
        'Concepto',
        'Mes de la cuota',
        'Cobrado',
        'Base',
        'Porcentaje',
        'A liquidar',
      ],
      [...rows, ...totals],
    );
  }

  /** Clases activas (y las que tienen reparto) con el reparto vigente en el mes. */
  async overview(periodValue: string): Promise<ClassSettlementOverviewDto[]> {
    const period = isoPeriod(parseBillingPeriod(periodValue, 'period'));
    const classes = await this.prisma.academyClass.findMany({
      where: { OR: [{ status: 'ACTIVE' }, { settlementPlans: { some: {} } }] },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        additionalTeachers: {
          include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
        },
        settlementPlans: { include: planInclude, orderBy: { validFrom: 'asc' } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return classes.map((item) => {
      const plans = item.settlementPlans.map(mapPlan);
      const current = plans.filter((plan) => plan.validFrom <= period).at(-1) ?? null;
      return {
        academicClass: {
          id: item.id,
          name: item.name,
          status: item.status,
          teachers: [item.teacher, ...item.additionalTeachers.map((extra) => extra.teacher)],
        },
        plan: current,
        upcoming: plans.filter((plan) => plan.validFrom > period),
      };
    });
  }

  async plans(classId: string) {
    const exists = await this.prisma.academyClass.count({ where: { id: classId } });
    if (!exists) throw new DomainError('CLASS_NOT_FOUND', 'Clase no encontrada');
    const plans = await this.prisma.classSettlementPlan.findMany({
      where: { classId },
      include: planInclude,
      orderBy: { validFrom: 'desc' },
    });
    return plans.map(mapPlan);
  }

  /** Guarda el reparto de una clase desde un mes (si ya había uno desde ese mes, lo reemplaza). */
  async savePlan(classId: string, input: SaveClassSettlementPlanDto, actor: PublicAuthUser) {
    const validFrom = parseBillingPeriod(String(input?.validFrom ?? ''), 'validFrom');
    const shares = validateShares(input?.shares);
    const reason = input?.reason?.trim() ? input.reason.trim().slice(0, 500) : null;
    const plan = await this.prisma.$transaction(async (tx) => {
      const academyClass = await tx.academyClass.findUnique({ where: { id: classId } });
      if (!academyClass) throw new DomainError('CLASS_NOT_FOUND', 'Clase no encontrada');
      const found = await tx.teacher.count({
        where: { id: { in: shares.map((share) => share.teacherId) } },
      });
      if (found !== shares.length)
        throw new DomainError('TEACHER_NOT_FOUND', 'Profesor no encontrado', { field: 'shares' });
      const previous = await tx.classSettlementPlan.findUnique({
        where: { classId_validFrom: { classId, validFrom } },
        include: { shares: true },
      });
      if (previous) await tx.classSettlementShare.deleteMany({ where: { planId: previous.id } });
      const saved = previous
        ? await tx.classSettlementPlan.update({
            where: { id: previous.id },
            data: { reason, createdByUserId: actor.id, shares: { create: shares } },
            include: planInclude,
          })
        : await tx.classSettlementPlan.create({
            data: {
              classId,
              validFrom,
              reason,
              createdByUserId: actor.id,
              shares: { create: shares },
            },
            include: planInclude,
          });
      const snapshot = (items: readonly { teacherId: string; percentage: Prisma.Decimal }[]) =>
        items.map((share) => ({
          teacherId: share.teacherId,
          percentage: share.percentage.toFixed(2),
        }));
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: previous ? 'UPDATE' : 'CREATE',
          entityType: 'CLASS_SETTLEMENT_PLAN',
          entityId: saved.id,
          reason,
          ...(previous
            ? { before: { validFrom: isoPeriod(validFrom), shares: snapshot(previous.shares) } }
            : {}),
          after: { validFrom: isoPeriod(validFrom), shares: snapshot(shares) },
          metadata: { classId, className: academyClass.name },
        },
      });
      return saved;
    });
    return mapPlan(plan);
  }
}
