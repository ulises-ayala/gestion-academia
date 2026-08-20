import { DomainError } from '../../shared/domain/domain-error';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const periodPattern = /^\d{4}-\d{2}$/;
const moneyPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export const parseBillingDate = (value: string, field: 'validFrom' | 'validTo' | 'dueDate') => {
  if (!datePattern.test(value))
    throw new DomainError('VALIDATION_ERROR', 'La fecha debe tener formato AAAA-MM-DD', { field });
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new DomainError('VALIDATION_ERROR', 'La fecha indicada no es válida', { field });
  return value;
};

export const parsePeriod = (value: string) => {
  if (!periodPattern.test(value))
    throw new DomainError('VALIDATION_ERROR', 'El período debe tener formato AAAA-MM', {
      field: 'period',
    });
  const date = new Date(`${value}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 7) !== value)
    throw new DomainError('VALIDATION_ERROR', 'El período indicado no es válido', {
      field: 'period',
    });
  return `${value}-01`;
};

export const normalizeMoney = (value: string, field = 'amount') => {
  if (typeof value !== 'string' || !moneyPattern.test(value))
    throw new DomainError(
      'VALIDATION_ERROR',
      'El monto debe ser un decimal no negativo con hasta dos decimales',
      { field },
    );
  const [integer, decimals = ''] = value.split('.');
  return `${integer}.${decimals.padEnd(2, '0')}`;
};

export const validateTariff = (input: {
  name: string;
  amount: string;
  validFrom: string;
  validTo?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}) => {
  const name = input.name?.trim();
  if (!name || name.length > 120)
    throw new DomainError('VALIDATION_ERROR', 'El nombre es obligatorio y admite 120 caracteres', {
      field: 'name',
    });
  const validFrom = parseBillingDate(input.validFrom, 'validFrom');
  const validTo = input.validTo ? parseBillingDate(input.validTo, 'validTo') : null;
  if (validTo && validTo < validFrom)
    throw new DomainError(
      'VALIDATION_ERROR',
      'La fecha de fin no puede ser anterior a la fecha de inicio',
      { field: 'validTo' },
    );
  return {
    name,
    amount: normalizeMoney(input.amount),
    validFrom,
    validTo,
    status: input.status ?? ('ACTIVE' as const),
  };
};

export const validateChargeDates = (periodValue: string, dueDateValue: string) => {
  const period = parsePeriod(periodValue);
  const dueDate = parseBillingDate(dueDateValue, 'dueDate');
  if (dueDate.slice(0, 7) !== period.slice(0, 7) || Number(dueDate.slice(8, 10)) > 10)
    throw new DomainError(
      'INVALID_DUE_DATE',
      'El vencimiento debe estar entre el día 1 y el 10 del período',
      { field: 'dueDate' },
    );
  return { period, dueDate };
};
