import { Prisma } from '@academy/database';
import { DomainError } from '../../shared/domain/domain-error';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const parseDate = (value: unknown, field: string) => {
  const text = typeof value === 'string' ? value : '';
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (
    !datePattern.test(text) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== text
  )
    throw new DomainError('VALIDATION_ERROR', 'La fecha no es válida', { field });
  return text;
};

/**
 * Valida una entrega de efectivo a Dirección. `today` es el día de Buenos Aires (AAAA-MM-DD): el
 * período no puede terminar en el futuro.
 */
export const validateCashHandover = (
  input: Readonly<{
    fromDate?: unknown;
    toDate?: unknown;
    amount?: unknown;
    receivedBy?: unknown;
    note?: unknown;
  }> | null,
  today: string,
) => {
  const fromDate = parseDate(input?.fromDate, 'fromDate');
  const toDate = parseDate(input?.toDate, 'toDate');
  if (toDate < fromDate)
    throw new DomainError('VALIDATION_ERROR', 'La fecha final no puede ser anterior a la inicial', {
      field: 'toDate',
    });
  if (toDate > today)
    throw new DomainError('VALIDATION_ERROR', 'El período no puede terminar en el futuro', {
      field: 'toDate',
    });
  const amount = input?.amount;
  if (typeof amount !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(amount))
    throw new DomainError('VALIDATION_ERROR', 'El importe debe ser un decimal positivo', {
      field: 'amount',
    });
  const decimal = new Prisma.Decimal(amount);
  if (decimal.lessThanOrEqualTo(0))
    throw new DomainError('VALIDATION_ERROR', 'El importe debe ser mayor a cero', {
      field: 'amount',
    });
  const text = (value: unknown, field: string, max: number) => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string')
      throw new DomainError('VALIDATION_ERROR', 'El texto no es válido', { field });
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (trimmed.length > max)
      throw new DomainError('VALIDATION_ERROR', `Admite hasta ${max} caracteres`, { field });
    return trimmed;
  };
  return {
    fromDate,
    toDate,
    amount: decimal,
    receivedBy: text(input?.receivedBy, 'receivedBy', 120) || 'Dirección',
    note: text(input?.note, 'note', 500) || null,
  };
};

/** true si dos períodos (AAAA-MM-DD, inclusivos) comparten al menos un día. */
export const periodsOverlap = (
  left: Readonly<{ fromDate: string; toDate: string }>,
  right: Readonly<{ fromDate: string; toDate: string }>,
) => left.fromDate <= right.toDate && right.fromDate <= left.toDate;
