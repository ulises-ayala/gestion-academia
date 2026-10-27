import type { BillingAdjustmentTypeDto, MonthlyChargeDto, TariffDto } from '@academy/contracts';

export const CHARGE_GENERATION_REPOSITORY = Symbol('CHARGE_GENERATION_REPOSITORY');

export type EnrollmentForGeneration = Readonly<{
  id: string;
  studentId: string;
  classId: string;
  className: string;
  status: 'ACTIVE' | 'ENDED';
  startDate: string;
  endDate: string | null;
}>;

export type ChargeConditionForPreview = Readonly<{
  type: BillingAdjustmentTypeDto;
  calculation: 'PERCENTAGE' | 'FIXED';
  configuredValue: string;
}>;

export type GeneratedChargeData = Readonly<{
  studentId: string;
  enrollmentId: string;
  tariffId: string;
  period: string;
  baseAmount: string;
  dueDate: string;
}>;

export interface ChargeGenerationRepository {
  findEnrollment(id: string): Promise<EnrollmentForGeneration | null>;
  classTariffs(classId: string): Promise<TariffDto[]>;
  /** Becas y descuentos vigentes en el mes (primer día del período). */
  conditionsFor(enrollmentId: string, period: string): Promise<ChargeConditionForPreview[]>;
  chargeExists(enrollmentId: string, period: string): Promise<boolean>;
  /** Otra inscripción del alumno a la misma clase que se pisaría al adelantar el inicio. */
  overlapsOtherEnrollment(enrollment: EnrollmentForGeneration, newStart: string): Promise<boolean>;
  /** Adelanta el inicio de la inscripción y deja auditoría. */
  moveEnrollmentStart(enrollmentId: string, newStart: string, actorId: string): Promise<void>;
  /** Crea la cuota con sus ajustes y deja la auditoría en la misma transacción. */
  create(data: GeneratedChargeData, actorId: string): Promise<MonthlyChargeDto>;
}
