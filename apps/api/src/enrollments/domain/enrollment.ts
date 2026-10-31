import { DomainError } from '../../shared/domain/domain-error';
import type { EnrollmentEndReasonDto } from '@academy/contracts';

const endReasons: readonly EnrollmentEndReasonDto[] = [
  'NO_LONGER_ATTENDING',
  'SCHEDULE_CHANGE',
  'DISCIPLINE_CHANGE',
  'PERSONAL_REASONS',
  'NON_PAYMENT',
  'OTHER',
];

export function validateEndReason(
  reason: unknown,
  note: unknown,
): {
  endReason: EnrollmentEndReasonDto;
  endNote: string | null;
} {
  if (typeof reason !== 'string' || !endReasons.includes(reason as EnrollmentEndReasonDto))
    throw new DomainError(
      'ENROLLMENT_END_REASON_REQUIRED',
      'Seleccioná un motivo de finalización.',
    );
  if (note != null && (typeof note !== 'string' || note.trim().length > 500))
    throw new DomainError(
      'INVALID_ENROLLMENT_END_NOTE',
      'La observación debe tener hasta 500 caracteres.',
    );
  const endNote = typeof note === 'string' ? note.trim() || null : null;
  if (reason === 'OTHER' && !endNote)
    throw new DomainError('ENROLLMENT_END_NOTE_REQUIRED', 'Contanos brevemente el motivo.');
  return { endReason: reason as EnrollmentEndReasonDto, endNote };
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function parseEnrollmentDate(value: string, field: 'startDate' | 'endDate'): Date {
  if (!datePattern.test(value)) {
    throw new DomainError('INVALID_ENROLLMENT_DATE', 'La fecha debe tener formato AAAA-MM-DD', {
      field,
    });
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new DomainError('INVALID_ENROLLMENT_DATE', 'La fecha indicada no es válida', { field });
  }
  return date;
}

const dayInMs = 24 * 60 * 60 * 1000;

export const nextDay = (date: Date) => new Date(date.getTime() + dayInMs);

/**
 * Cambio de clase: la inscripción actual termina el día previo al cambio y la nueva empieza ese
 * día, así ambos períodos no se superponen. Devuelve la fecha de finalización de la actual.
 */
export function classChangeEndDate(
  current: { classId: string; startDate: Date },
  target: { classId: string; startDate: Date },
): Date {
  if (current.classId === target.classId)
    throw new DomainError('ENROLLMENT_SAME_CLASS', 'El alumno ya está inscripto en esa clase.');
  if (target.startDate <= current.startDate)
    throw new DomainError(
      'INVALID_CLASS_CHANGE_DATE',
      `El cambio debe ser posterior al inicio de la inscripción actual (${current.startDate.toISOString().slice(0, 10)}).`,
      { field: 'changeDate' },
    );
  return new Date(target.startDate.getTime() - dayInMs);
}

const formatDay = (date: Date) => date.toISOString().slice(0, 10).split('-').reverse().join('/');

/**
 * Dos períodos de la misma clase no se superponen (una cuota por inscripción y mes). Explica con
 * qué inscripción choca: no es un conflicto de horario aunque los horarios sean los mismos.
 */
export function samePeriodEnrollmentError(
  existing: { id: string; startDate: Date; endDate: Date | null },
  reactivating: boolean,
): DomainError {
  const details = {
    enrollmentId: existing.id,
    startDate: existing.startDate.toISOString().slice(0, 10),
    endDate: existing.endDate?.toISOString().slice(0, 10) ?? null,
  };
  if (reactivating)
    return new DomainError(
      'ENROLLMENT_REACTIVATION_SUPERSEDED',
      `El alumno tiene otra inscripción posterior a esta clase (desde el ${formatDay(existing.startDate)}). Reactivá la más reciente.`,
      details,
    );
  if (!existing.endDate)
    return new DomainError(
      'ENROLLMENT_PERIOD_OVERLAP',
      'El alumno tiene una inscripción finalizada a esta clase sin fecha de fin. Administración o Dirección pueden reactivarla desde el historial de inscripciones.',
      details,
    );
  const nextStart = nextDay(existing.endDate);
  return new DomainError(
    'ENROLLMENT_PERIOD_OVERLAP',
    `El alumno tuvo una inscripción a esta clase hasta el ${formatDay(existing.endDate)}. Elegí un inicio desde el ${formatDay(nextStart)} o reactivá esa inscripción desde el historial (Administración o Dirección).`,
    { ...details, nextStartDate: nextStart.toISOString().slice(0, 10) },
  );
}

export function validateEndDate(startDate: Date, endDateValue: string): Date {
  const endDate = parseEnrollmentDate(endDateValue, 'endDate');
  if (endDate < startDate) {
    throw new DomainError(
      'END_DATE_BEFORE_START_DATE',
      'La fecha de finalización no puede ser anterior a la fecha de inscripción',
      { field: 'endDate' },
    );
  }
  return endDate;
}
