import { DomainError } from '../../shared/domain/domain-error';

export const FOLLOW_UP_MIN_ABSENCES = 3;
const maxMinimumAbsences = 2_147_483_647;

export function parseFollowUpFilters(q?: string, minAbsences?: string) {
  if (q && q.length > 100)
    throw new DomainError('VALIDATION_ERROR', 'La búsqueda admite hasta 100 caracteres.');
  const value = minAbsences?.trim();
  if (value && (!/^[1-9]\d*$/.test(value) || Number(value) > maxMinimumAbsences))
    throw new DomainError(
      'VALIDATION_ERROR',
      'Las ausencias consecutivas mínimas deben ser un entero igual o mayor que 1.',
      { field: 'minAbsences' },
    );
  return {
    q: q?.trim() ?? '',
    minAbsences: value ? Number(value) : FOLLOW_UP_MIN_ABSENCES,
  };
}
