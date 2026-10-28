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
