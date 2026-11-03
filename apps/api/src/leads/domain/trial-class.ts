import type { LeadStatusDto } from '@academy/contracts';
import { DomainError } from '../../shared/domain/domain-error';

export const TRIAL_NOTES_MAX = 500;

/**
 * Valida la clase de prueba: clase obligatoria, día (por defecto hoy, nunca futuro) y nota
 * opcional. `today` es el día de negocio (AAAA-MM-DD).
 */
export const validateTrialClass = (
  input: { classId?: unknown; trialDate?: unknown; notes?: unknown },
  today: string,
) => {
  if (typeof input.classId !== 'string' || !input.classId)
    throw new DomainError('VALIDATION_ERROR', 'Elegí la clase que prueba', { field: 'classId' });
  let trialDate = today;
  if (input.trialDate !== undefined && input.trialDate !== null && input.trialDate !== '') {
    if (
      typeof input.trialDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.trialDate) ||
      Number.isNaN(Date.parse(`${input.trialDate}T00:00:00.000Z`)) ||
      new Date(`${input.trialDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== input.trialDate
    )
      throw new DomainError('VALIDATION_ERROR', 'La fecha de la prueba no es válida', {
        field: 'trialDate',
      });
    if (input.trialDate > today)
      throw new DomainError('VALIDATION_ERROR', 'La clase de prueba no puede ser futura', {
        field: 'trialDate',
      });
    trialDate = input.trialDate;
  }
  if (input.notes !== undefined && input.notes !== null && typeof input.notes !== 'string')
    throw new DomainError('VALIDATION_ERROR', 'La nota no es válida', { field: 'notes' });
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (notes.length > TRIAL_NOTES_MAX)
    throw new DomainError(
      'VALIDATION_ERROR',
      `La nota admite hasta ${TRIAL_NOTES_MAX} caracteres`,
      {
        field: 'notes',
      },
    );
  return { classId: input.classId, trialDate, notes: notes || null };
};

/** Al registrar la prueba, una consulta o un interesado pasan a "Clase de prueba". */
export const statusAfterTrial = (status: LeadStatusDto): LeadStatusDto =>
  status === 'INQUIRY' || status === 'INTERESTED' ? 'TRIAL' : status;
