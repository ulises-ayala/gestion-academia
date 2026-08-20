import { DomainError } from '../../shared/domain/domain-error';

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
