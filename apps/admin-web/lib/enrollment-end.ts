import type { EnrollmentEndReasonDto } from '@academy/contracts';

export const enrollmentEndLabels: Record<EnrollmentEndReasonDto, string> = {
  NO_LONGER_ATTENDING: 'Dejó la actividad',
  SCHEDULE_CHANGE: 'Cambio de horario',
  DISCIPLINE_CHANGE: 'Cambio de disciplina',
  PERSONAL_REASONS: 'Motivos personales',
  NON_PAYMENT: 'Morosidad',
  OTHER: 'Otro',
};
export const enrollmentEndLabel = (reason: EnrollmentEndReasonDto | null) =>
  reason ? enrollmentEndLabels[reason] : 'Sin motivo registrado';
