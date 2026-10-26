import type { GenerateMonthlyChargeDto, MonthlyChargePreviewDto } from '@academy/contracts';
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
    const period = assertGenerationPeriod(input.period);
    const dates = validateChargeDates(period, input.dueDate ?? defaultDueDate(period));
    const enrollment = await this.repository.findEnrollment(input.enrollmentId);
    if (!enrollment) throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada');
    if (enrollment.status !== 'ACTIVE')
      throw new DomainError(
        'ENROLLMENT_INACTIVE_FOR_CHARGE',
        'La inscripción debe estar activa para generar una cuota',
      );
    const today = this.today(now);
    const currentPeriod = today.slice(0, 7);
    assertPeriodAllowed({
      period,
      currentPeriod,
      canBackfill: actor.canBackfill,
      enrollmentStart: enrollment.startDate,
      enrollmentEnd: enrollment.endDate,
    });
    const tariff = pickTariff(
      await this.repository.classTariffs(enrollment.classId),
      period,
      currentPeriod,
    );
    return { period, dueDate: dates.dueDate, enrollment, tariff, today };
  }

  async preview(
    input: GenerateMonthlyChargeDto,
    actor: GenerationActor,
    now = new Date(),
  ): Promise<MonthlyChargePreviewDto> {
    const { period, dueDate, enrollment, tariff, today } = await this.resolve(input, actor, now);
    const conditions = await this.repository.conditionsFor(enrollment.id, period);
    const base = new Prisma.Decimal(tariff.amount);
    const due = adjustedAmounts(
      base,
      conditions.map((condition) =>
        conditionDeltas(base, {
          ...condition,
          configuredValue: new Prisma.Decimal(condition.configuredValue),
        }),
      ),
    );
    return {
      enrollmentId: enrollment.id,
      className: enrollment.className,
      period,
      dueDate,
      tariff: { id: tariff.id, name: tariff.name, amount: tariff.amount },
      studentDueAmount: due.studentDue.toFixed(2),
      adjustments: conditions.map(({ type }) => type),
      alreadyExists: await this.repository.chargeExists(enrollment.id, period),
      lateFeeOnCollect: dueDate < today && !due.studentDue.isZero(),
    };
  }

  async generate(input: GenerateMonthlyChargeDto, actor: GenerationActor, now = new Date()) {
    const { period, dueDate, enrollment, tariff } = await this.resolve(input, actor, now);
    if (await this.repository.chargeExists(enrollment.id, period))
      throw new DomainError(
        'MONTHLY_CHARGE_ALREADY_EXISTS',
        'La inscripción ya tiene una cuota para ese mes',
      );
    return this.repository.create(
      {
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        tariffId: tariff.id,
        period,
        baseAmount: tariff.amount,
        dueDate,
      },
      actor.id,
    );
  }
}
