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
