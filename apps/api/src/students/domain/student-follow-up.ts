import { DomainError } from '../../shared/domain/domain-error';

export const FOLLOW_UP_MIN_ABSENCES = 3;

export function parseFollowUpFilters(q?: string, minAbsences?: string) {
  if (q && q.length > 100)
    throw new DomainError('VALIDATION_ERROR', 'La búsqueda admite hasta 100 caracteres.');
  if (minAbsences && !['3', '4', '5'].includes(minAbsences))
    throw new DomainError('VALIDATION_ERROR', 'Elegí 3, 4 o 5 ausencias mínimas.');
  return {
    q: q?.trim() ?? '',
    minAbsences: minAbsences ? Number(minAbsences) : FOLLOW_UP_MIN_ABSENCES,
  };
}
