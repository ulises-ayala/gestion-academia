import type { LeadStatusDto, RegisterTrialVisitDto } from '@academy/contracts';
import { DomainError } from '../../shared/domain/domain-error';
import { validateLeadInput } from './lead';

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

const firstNameKey = (name: string) =>
  (name.trim().split(/\s+/)[0] ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Es la misma persona si coincide el nombre de pila (sin mayúsculas ni tildes): el teléfono solo
 * no alcanza, porque una familia puede dejar el mismo número para dos chicos.
 */
export const sameFirstName = (left: string, right: string) =>
  firstNameKey(left) !== '' && firstNameKey(left) === firstNameKey(right);

/**
 * Etapa del potencial después de una visita de prueba: vuelve a "Clase de prueba" (aunque se
 * hubiera marcado "No concretó"), salvo que ya se haya inscripto como alumno.
 */
export const statusAfterVisit = (
  lead: Readonly<{ status: LeadStatusDto; studentId: string | null }>,
) => (lead.studentId ? lead.status : ('TRIAL' as const));

/**
 * Datos de quien viene a una clase de prueba: el potencial alumno (nombre, teléfono obligatorio
 * para reconocerlo si vuelve, correo y origen) y la prueba.
 */
export const validateTrialVisit = (input: Partial<RegisterTrialVisitDto>, today: string) => {
  const firstName = typeof input.firstName === 'string' ? input.firstName.trim() : '';
  if (!firstName)
    throw new DomainError('VALIDATION_ERROR', 'El nombre es obligatorio', { field: 'firstName' });
  const lastName = typeof input.lastName === 'string' ? input.lastName.trim() : '';
  if (typeof input.phone !== 'string' || input.phone.replace(/\D/g, '').length < 6)
    throw new DomainError(
      'VALIDATION_ERROR',
      'Cargá el teléfono: con él se reconoce si vuelve o si ya tomó la prueba',
      { field: 'phone' },
    );
  const person = validateLeadInput({
    name: [firstName, lastName].filter(Boolean).join(' '),
    source: input.source ?? 'IN_PERSON',
    phone: input.phone,
    email: input.email,
    status: 'TRIAL',
  });
  return { person, trial: validateTrialClass(input, today) };
};
