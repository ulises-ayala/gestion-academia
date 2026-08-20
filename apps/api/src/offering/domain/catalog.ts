import { DomainError } from '../../shared/domain/domain-error';
export type Status = 'ACTIVE' | 'INACTIVE';
const required = (value: unknown, field: string, max: number) => {
  if (typeof value !== 'string' || !value.trim())
    throw new DomainError('VALIDATION_ERROR', `${field} es obligatorio`, { field });
  const result = value.trim().replace(/\s+/g, ' ');
  if (result.length > max)
    throw new DomainError('VALIDATION_ERROR', `${field} supera los ${max} caracteres`, { field });
  return result;
};
const optional = (value: unknown, field: string, max: number) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string')
    throw new DomainError('VALIDATION_ERROR', `${field} debe ser texto`, { field });
  const result = value.trim();
  if (result.length > max)
    throw new DomainError('VALIDATION_ERROR', `${field} supera los ${max} caracteres`, { field });
  return result || null;
};
const status = (value?: Status) => {
  if (value !== undefined && value !== 'ACTIVE' && value !== 'INACTIVE')
    throw new DomainError('VALIDATION_ERROR', 'Estado inválido', { field: 'status' });
  return value ?? 'ACTIVE';
};
export const validateDanceType = (input: {
  name: unknown;
  description?: unknown;
  status?: Status;
}) => {
  const name = required(input.name, 'name', 100);
  return {
    name,
    normalizedName: name.toLocaleLowerCase('es'),
    description: optional(input.description, 'description', 1000),
    status: status(input.status),
  };
};
export const validateBranch = (input: { name: unknown; address: unknown; status?: Status }) => ({
  name: required(input.name, 'name', 120),
  address: required(input.address, 'address', 500),
  status: status(input.status),
});
export const validateRoom = (input: {
  name: unknown;
  capacity: unknown;
  branchId: unknown;
  status?: Status;
}) => {
  if (
    typeof input.capacity !== 'number' ||
    !Number.isInteger(input.capacity) ||
    input.capacity <= 0
  )
    throw new DomainError('VALIDATION_ERROR', 'La capacidad debe ser un entero positivo', {
      field: 'capacity',
    });
  return {
    name: required(input.name, 'name', 120),
    capacity: input.capacity,
    branchId: required(input.branchId, 'branchId', 36),
    status: status(input.status),
  };
};
