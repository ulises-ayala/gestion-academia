import type {
  ChargeBatchPreviewDto,
  CreateHistoricalDebtDto,
  GenerateChargeBatchDto,
  GenerateMonthlyChargeDto,
  GeneratedChargeBatchDto,
  GeneratedMonthlyChargesDto,
  MonthlyChargeDto,
  MonthlyChargePreviewDto,
} from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { businessDayAt } from '../../dashboard/application/business-day';
import { validateChargeDates } from '../domain/billing';
import { adjustedAmounts, conditionDeltas } from '../domain/billing-adjustments';
import { historicalDebtDates, validateHistoricalDebt } from '../domain/historical-debt';
import {
  MAX_BATCH_CHARGES,
  assertGenerationPeriod,
  assertPeriodAllowed,
  dueDateFor,
  periodsBetween,
  pickTariff,
} from '../domain/charge-generation';
import {
  CHARGE_GENERATION_REPOSITORY,
  type ChargeGenerationRepository,
  type EnrollmentForGeneration,
} from './charge-generation.repository';

export type GenerationActor = Readonly<{ id: string; canBackfill: boolean }>;

@Injectable()
export class ChargeGenerationService {
  constructor(
    @Inject(CHARGE_GENERATION_REPOSITORY) private readonly repository: ChargeGenerationRepository,
  ) {}

  private today(now: Date) {
    return businessDayAt(now, process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires').date;
  }

  private resolve(input: GenerateMonthlyChargeDto, actor: GenerationActor, now: Date) {
    const first = assertGenerationPeriod(input.period);
    const until = input.untilPeriod ? assertGenerationPeriod(input.untilPeriod) : first;
    const periods = periodsBetween(first, until);
    return this.resolvePeriods(
      input.enrollmentId,
      periods,
      {
        allowBeforeStart: actor.canBackfill,
        ...(periods.length === 1 && input.dueDate ? { dueDate: input.dueDate } : {}),
      },
      now,
    );
  }

  /** Valida inscripción, meses y tarifas de una inscripción; `periods` va ordenado. */
  private async resolvePeriods(
    enrollmentId: string,
    periods: readonly string[],
    options: Readonly<{ allowBeforeStart: boolean; dueDate?: string }>,
    now: Date,
  ) {
    const first = periods[0]!;
    const enrollment = await this.repository.findEnrollment(enrollmentId);
    if (!enrollment) throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada');
    if (enrollment.status !== 'ACTIVE')
      throw new DomainError(
        'ENROLLMENT_INACTIVE_FOR_CHARGE',
        'La inscripción debe estar activa para generar una cuota',
      );
    const today = this.today(now);
    const currentPeriod = today.slice(0, 7);
    for (const period of periods)
      assertPeriodAllowed({
        period,
        currentPeriod,
        enrollmentStart: enrollment.startDate,
        enrollmentEnd: enrollment.endDate,
        allowBeforeStart: options.allowBeforeStart,
      });
    const enrollmentStartChange =
      first < enrollment.startDate.slice(0, 7)
        ? { from: enrollment.startDate, to: `${first}-01` }
        : null;
    if (
      enrollmentStartChange &&
      (await this.repository.overlapsOtherEnrollment(enrollment, enrollmentStartChange.to))
    )
      throw new DomainError(
        'ENROLLMENT_START_CONFLICT',
        'No se puede adelantar el inicio: el alumno tuvo otra inscripción a esta clase en esos meses.',
        { field: 'period' },
      );
    const tariffs = await this.repository.classTariffs(enrollment.classId);
    const months = [];
    for (const period of periods) {
      const { dueDate } = validateChargeDates(
        period,
        options.dueDate ?? dueDateFor(period, enrollment.paymentDueDay),
      );
      months.push({
        period,
        dueDate,
        tariff: pickTariff(tariffs, period, currentPeriod, enrollment.tariff),
        alreadyExists: await this.repository.chargeExists(enrollment.id, period),
      });
    }
    return { enrollment, months, enrollmentStartChange };
  }

  async preview(
    input: GenerateMonthlyChargeDto,
    actor: GenerationActor,
    now = new Date(),
  ): Promise<MonthlyChargePreviewDto> {
    const { enrollment, months, enrollmentStartChange } = await this.resolve(input, actor, now);
    const detailed = await this.detail(enrollment, months);
    const pending = detailed.filter((month) => !month.alreadyExists);
    return {
      enrollmentId: enrollment.id,
      className: enrollment.className,
      months: detailed,
      newCount: pending.length,
      newTotal: pending
        .reduce((sum, month) => sum.plus(month.studentDueAmount), new Prisma.Decimal(0))
        .toFixed(2),
      enrollmentStartChange: pending.length ? enrollmentStartChange : null,
    };
  }

  /** Importe de cada mes con las becas y descuentos vigentes en ese mes. */
  private async detail(
    enrollment: EnrollmentForGeneration,
    months: Awaited<ReturnType<ChargeGenerationService['resolvePeriods']>>['months'],
  ) {
    const detailed = [];
    for (const month of months) {
      const conditions = await this.repository.conditionsFor(enrollment.id, month.period);
      const base = new Prisma.Decimal(month.tariff.amount);
      const due = adjustedAmounts(
        base,
        conditions.map((condition) =>
          conditionDeltas(base, {
            ...condition,
            configuredValue: new Prisma.Decimal(condition.configuredValue),
          }),
        ),
      );
      detailed.push({
        period: month.period,
        dueDate: month.dueDate,
        tariff: { id: month.tariff.id, name: month.tariff.name, amount: month.tariff.amount },
        studentDueAmount: due.studentDue.toFixed(2),
        adjustments: conditions.map(({ type }) => type),
        alreadyExists: month.alreadyExists,
      });
    }
    return detailed;
  }

  /**
   * Varias clases y meses de un alumno (la grilla de cuotas). Agrupa por inscripción y valida
   * todo antes de crear nada; nunca adelanta el inicio de una inscripción.
   */
  private async resolveBatch(input: GenerateChargeBatchDto, now: Date) {
    const items = input.items;
    if (!Array.isArray(items) || items.length === 0)
      throw new DomainError('VALIDATION_ERROR', 'Elegí al menos una cuota para generar', {
        field: 'items',
      });
    if (items.length > MAX_BATCH_CHARGES)
      throw new DomainError(
        'VALIDATION_ERROR',
        `Se pueden generar hasta ${MAX_BATCH_CHARGES} cuotas de una vez`,
        { field: 'items' },
      );
    const byEnrollment = new Map<string, string[]>();
    for (const item of items) {
      const period = assertGenerationPeriod(item?.period);
      const periods = byEnrollment.get(item.enrollmentId) ?? [];
      if (periods.includes(period))
        throw new DomainError('VALIDATION_ERROR', 'Una cuota está repetida', { field: 'items' });
      byEnrollment.set(item.enrollmentId, [...periods, period]);
    }
    const groups = [];
    for (const [enrollmentId, periods] of byEnrollment) {
      const group = await this.resolvePeriods(
        enrollmentId,
        [...periods].sort(),
        { allowBeforeStart: false },
        now,
      );
      if (group.enrollment.studentId !== input.studentId)
        throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada');
      groups.push(group);
    }
    return groups;
  }

  async previewBatch(
    input: GenerateChargeBatchDto,
    now = new Date(),
  ): Promise<ChargeBatchPreviewDto> {
    const groups = await this.resolveBatch(input, now);
    const itemsOut = [];
    for (const { enrollment, months } of groups)
      for (const month of await this.detail(enrollment, months))
        itemsOut.push({ enrollmentId: enrollment.id, className: enrollment.className, ...month });
    const pending = itemsOut.filter((item) => !item.alreadyExists);
    return {
      items: itemsOut,
      newCount: pending.length,
      newTotal: pending
        .reduce((sum, item) => sum.plus(item.studentDueAmount), new Prisma.Decimal(0))
        .toFixed(2),
    };
  }

  async generateBatch(
    input: GenerateChargeBatchDto,
    actorId: string,
    now = new Date(),
  ): Promise<GeneratedChargeBatchDto> {
    const groups = await this.resolveBatch(input, now);
    const all = groups.flatMap(({ enrollment, months }) =>
      months.map((month) => ({ enrollment, month })),
    );
    const pending = all.filter(({ month }) => !month.alreadyExists);
    if (pending.length === 0)
      throw new DomainError('MONTHLY_CHARGE_ALREADY_EXISTS', 'Esas cuotas ya estaban generadas');
    const created: MonthlyChargeDto[] = [];
    for (const { enrollment, month } of pending)
      created.push(
        await this.repository.create(
          {
            studentId: enrollment.studentId,
            enrollmentId: enrollment.id,
            tariffId: month.tariff.id,
            period: month.period,
            baseAmount: month.tariff.amount,
            dueDate: month.dueDate,
          },
          actorId,
        ),
      );
    return {
      created,
      skipped: all
        .filter(({ month }) => month.alreadyExists)
        .map(({ enrollment, month }) => ({ enrollmentId: enrollment.id, period: month.period })),
    };
  }

  async generate(
    input: GenerateMonthlyChargeDto,
    actor: GenerationActor,
    now = new Date(),
  ): Promise<GeneratedMonthlyChargesDto> {
    const { enrollment, months, enrollmentStartChange } = await this.resolve(input, actor, now);
    const pending = months.filter((month) => !month.alreadyExists);
    if (pending.length === 0)
      throw new DomainError(
        'MONTHLY_CHARGE_ALREADY_EXISTS',
        months.length === 1
          ? 'La inscripción ya tiene una cuota para ese mes'
          : 'La inscripción ya tiene cuota en todos esos meses',
      );
    // Se valida todo antes de crear: inscripción, meses, tarifas y superposición.
    if (enrollmentStartChange)
      await this.repository.moveEnrollmentStart(enrollment.id, enrollmentStartChange.to, actor.id);
    const created: MonthlyChargeDto[] = [];
    for (const month of pending)
      created.push(
        await this.repository.create(
          {
            studentId: enrollment.studentId,
            enrollmentId: enrollment.id,
            tariffId: month.tariff.id,
            period: month.period,
            baseAmount: month.tariff.amount,
            dueDate: month.dueDate,
          },
          actor.id,
        ),
      );
    return {
      created,
      skippedPeriods: months.filter((month) => month.alreadyExists).map(({ period }) => period),
    };
  }

  /**
   * Deuda anterior al sistema (la que no trajo la importación): monto único con detalle, ligado
   * a una inscripción del alumno (activa o finalizada) para que el reporte la atribuya a la clase.
   */
  async createHistoricalDebt(input: CreateHistoricalDebtDto, actorId: string) {
    const { amount, description } = validateHistoricalDebt(input);
    const enrollment = await this.repository.findEnrollment(input.enrollmentId);
    if (!enrollment) throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada');
    const { period, dueDate } = historicalDebtDates(enrollment.startDate);
    return this.repository.createHistoricalDebt(
      {
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        amount,
        description,
        period,
        dueDate,
      },
      actorId,
    );
  }
}
