import type { OtherPaymentConceptDto } from '@academy/contracts';
import { DomainError } from '../../shared/domain/domain-error';

const concepts: readonly OtherPaymentConceptDto[] = ['SINGLE_CLASS', 'OTHER', 'CARD_SURCHARGE'];
export const OTHER_PAYMENT_DETAIL_MAX = 200;

/**
 * Valida el concepto de un cobro que no es de cuotas. La clase suelta exige la clase; un concepto
 * del catálogo (`OTHER`) exige cuál es. Si el concepto pide detalle lo valida `assertConceptDetail`.
 */
export const validateOtherPayment = (input: {
  concept: unknown;
  conceptId?: unknown;
  classId?: unknown;
  teacherId?: unknown;
  detail?: unknown;
}) => {
  if (
    typeof input.concept !== 'string' ||
    !concepts.includes(input.concept as OtherPaymentConceptDto)
  )
    throw new DomainError('VALIDATION_ERROR', 'Elegí a qué corresponde el cobro', {
      field: 'concept',
    });
  const concept = input.concept as OtherPaymentConceptDto;
  if (input.detail !== undefined && input.detail !== null && typeof input.detail !== 'string')
    throw new DomainError('VALIDATION_ERROR', 'El detalle no es válido', { field: 'detail' });
  const detail = typeof input.detail === 'string' ? input.detail.trim().replace(/\s+/g, ' ') : '';
  if (detail.length > OTHER_PAYMENT_DETAIL_MAX)
    throw new DomainError(
      'VALIDATION_ERROR',
      `El detalle admite hasta ${OTHER_PAYMENT_DETAIL_MAX} caracteres`,
      { field: 'detail' },
    );
  const conceptId =
    concept === 'OTHER' && typeof input.conceptId === 'string' && input.conceptId
      ? input.conceptId
      : null;
  if (concept === 'OTHER' && !conceptId)
    throw new DomainError('VALIDATION_ERROR', 'Elegí a qué corresponde el cobro', {
      field: 'conceptId',
    });
  const classId = typeof input.classId === 'string' && input.classId ? input.classId : null;
  if (concept === 'SINGLE_CLASS' && !classId)
    throw new DomainError('VALIDATION_ERROR', 'Elegí la clase suelta', { field: 'classId' });
  const teacherId = typeof input.teacherId === 'string' && input.teacherId ? input.teacherId : null;
  return {
    concept,
    conceptId,
    detail: detail || null,
    // Clase y profesor solo se registran en la clase suelta.
    classId: concept === 'SINGLE_CLASS' ? classId : null,
    teacherId: concept === 'SINGLE_CLASS' ? teacherId : null,
  };
};

/** Un concepto del catálogo que pide detalle (por ejemplo, "Otros") exige contar qué se cobró. */
export const assertConceptDetail = (requiresDetail: boolean, detail: string | null) => {
  if (requiresDetail && (detail ?? '').length < 3)
    throw new DomainError('VALIDATION_ERROR', 'Contá brevemente qué se cobra', {
      field: 'detail',
    });
};

/** Nombre del concepto como se guarda para no repetirlo (sin mayúsculas, tildes ni espacios de más). */
export const normalizeConceptName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim()
    .replace(/\s+/g, ' ');

/** Valida el alta o la edición de un concepto del catálogo. */
export const validatePaymentConcept = (input: {
  name?: unknown;
  requiresDetail?: unknown;
  status?: unknown;
}) => {
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 80)
    throw new DomainError('VALIDATION_ERROR', 'El nombre debe tener entre 2 y 80 caracteres', {
      field: 'name',
    });
  if (input.requiresDetail !== undefined && typeof input.requiresDetail !== 'boolean')
    throw new DomainError('VALIDATION_ERROR', 'El valor no es válido', { field: 'requiresDetail' });
  if (input.status !== undefined && input.status !== 'ACTIVE' && input.status !== 'INACTIVE')
    throw new DomainError('VALIDATION_ERROR', 'Estado inválido', { field: 'status' });
  return {
    name,
    normalizedName: normalizeConceptName(name),
    requiresDetail: input.requiresDetail === true,
    ...(input.status ? { status: input.status as 'ACTIVE' | 'INACTIVE' } : {}),
  };
};

const optionalText = (value: unknown, field: string, max: number, label: string) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string')
    throw new DomainError('VALIDATION_ERROR', `${label} no es válido`, { field });
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length > max)
    throw new DomainError('VALIDATION_ERROR', `${label} admite hasta ${max} caracteres`, {
      field,
    });
  return text || null;
};

/**
 * Alumno eventual: quien toma una clase suelta sin ser alumno regular. Nombre obligatorio;
 * teléfono y DNI opcionales (el DNI se guarda solo con dígitos).
 */
export const validateWalkIn = (input: unknown) => {
  if (!input || typeof input !== 'object')
    throw new DomainError('VALIDATION_ERROR', 'Indicá el alumno o el alumno eventual', {
      field: 'studentId',
    });
  const walkIn = input as { name?: unknown; phone?: unknown; dni?: unknown };
  const name = optionalText(walkIn.name, 'walkIn.name', 160, 'El nombre');
  if (!name || name.length < 2)
    throw new DomainError('VALIDATION_ERROR', 'Escribí el nombre del alumno eventual', {
      field: 'walkIn.name',
    });
  const phone = optionalText(walkIn.phone, 'walkIn.phone', 80, 'El teléfono');
  const rawDni = optionalText(walkIn.dni, 'walkIn.dni', 32, 'El DNI');
  const dni = rawDni ? rawDni.replace(/\D/g, '') : null;
  if (rawDni && (!/^[\d.\-\s]+$/.test(rawDni) || !dni || dni.length < 6 || dni.length > 9))
    throw new DomainError('VALIDATION_ERROR', 'El DNI debe tener entre 6 y 9 dígitos', {
      field: 'walkIn.dni',
    });
  return { name, phone, dni };
};
