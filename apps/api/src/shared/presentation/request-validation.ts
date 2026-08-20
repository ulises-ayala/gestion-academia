import { DomainError } from '../domain/domain-error';

export const parseUuid = (id: string, field = 'id') => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new DomainError('VALIDATION_ERROR', 'El identificador no es válido', { field });
  return id;
};
export const parsePage = (value: string | undefined, field: 'page' | 'pageSize', fallback: number, maximum: number) => {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value)) throw new DomainError('VALIDATION_ERROR', `${field} debe ser un entero positivo`, { field });
  const parsed = Number(value); if (parsed < 1 || parsed > maximum) throw new DomainError('VALIDATION_ERROR', `${field} debe estar entre 1 y ${maximum}`, { field }); return parsed;
};
export const parseStatus = (value?: string) => { if (value !== undefined && value !== '' && value !== 'ACTIVE' && value !== 'INACTIVE') throw new DomainError('VALIDATION_ERROR', 'Estado inválido', { field: 'status' }); return value ? value as 'ACTIVE' | 'INACTIVE' : undefined; };
