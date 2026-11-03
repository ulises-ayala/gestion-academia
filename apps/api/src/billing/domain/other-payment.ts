import type { OtherPaymentConceptDto } from '@academy/contracts';
import { DomainError } from '../../shared/domain/domain-error';

const concepts: readonly OtherPaymentConceptDto[] = [
  'SINGLE_CLASS',
  'APPAREL',
  'GALA_SEAL',
  'CARD_SURCHARGE',
  'OTHER',
];
export const OTHER_PAYMENT_DETAIL_MAX = 200;

/**
 * Valida el concepto de un cobro que no es de cuotas. La clase suelta exige la clase;
 * "Otro" exige un detalle que explique qué se cobró.
 */
export const validateOtherPayment = (input: {
  concept: unknown;
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
  if (concept === 'OTHER' && detail.length < 3)
    throw new DomainError('VALIDATION_ERROR', 'Contá brevemente qué se cobra', {
      field: 'detail',
    });
  const classId = typeof input.classId === 'string' && input.classId ? input.classId : null;
  if (concept === 'SINGLE_CLASS' && !classId)
    throw new DomainError('VALIDATION_ERROR', 'Elegí la clase suelta', { field: 'classId' });
  const teacherId = typeof input.teacherId === 'string' && input.teacherId ? input.teacherId : null;
  return {
    concept,
    detail: detail || null,
    // Clase y profesor solo se registran en la clase suelta.
    classId: concept === 'SINGLE_CLASS' ? classId : null,
    teacherId: concept === 'SINGLE_CLASS' ? teacherId : null,
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
