import type {
  GenerateMonthlyChargeDto,
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
import {
  assertGenerationPeriod,
  assertPeriodAllowed,
  defaultDueDate,
  periodsBetween,
  pickTariff,
} from '../domain/charge-generation';
import {
  CHARGE_GENERATION_REPOSITORY,
  type ChargeGenerationRepository,
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

  private async resolve(input: GenerateMonthlyChargeDto, actor: GenerationActor, now: Date) {
    const first = assertGenerationPeriod(input.period);
    const until = input.untilPeriod ? assertGenerationPeriod(input.untilPeriod) : first;
    const periods = periodsBetween(first, until);
    const single = periods.length === 1;
    const enrollment = await this.repository.findEnrollment(input.enrollmentId);
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
        canBackfill: actor.canBackfill,
        enrollmentStart: enrollment.startDate,
        enrollmentEnd: enrollment.endDate,
        allowBeforeStart: actor.canBackfill,
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
        single && input.dueDate ? input.dueDate : defaultDueDate(period),
      );
      months.push({
        period,
        dueDate,
        tariff: pickTariff(tariffs, period, currentPeriod),
        alreadyExists: await this.repository.chargeExists(enrollment.id, period),
      });
    }
    return { enrollment, months, today, enrollmentStartChange };
  }

  async preview(
    input: GenerateMonthlyChargeDto,
    actor: GenerationActor,
    now = new Date(),
  ): Promise<MonthlyChargePreviewDto> {
    const { enrollment, months, today, enrollmentStartChange } = await this.resolve(
      input,
      actor,
      now,
    );
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
        lateFeeOnCollect: month.dueDate < today && !due.studentDue.isZero(),
      });
    }
    const pending = detailed.filter((month) => !month.alreadyExists);
    return {
      enrollmentId: enrollment.id,
      className: enrollment.className,
      months: detailed,
      newCount: pending.length,
      newTotal: pending
        .reduce((sum, month) => sum.plus(month.studentDueAmount), new Prisma.Decimal(0))
        .toFixed(2),
      lateFeeCount: pending.filter((month) => month.lateFeeOnCollect).length,
      enrollmentStartChange: pending.length ? enrollmentStartChange : null,
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
}
