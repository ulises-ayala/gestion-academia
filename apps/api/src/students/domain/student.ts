import { DomainError } from '../../shared/domain/domain-error';

export type StudentStatus = 'ACTIVE' | 'INACTIVE';

export type StudentData = Readonly<{
  id: string;
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  joinedAt: Date;
  status: StudentStatus;
  createdAt: Date;
  updatedAt: Date;
}>;

export type StudentInput = Readonly<{
  dni: string;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status?: StudentStatus;
}>;

const requiredText = (value: unknown, field: string, max: number): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError('VALIDATION_ERROR', `${field} es obligatorio`, { field });
  }
  const normalized = value.trim();
  if (normalized.length > max) {
    throw new DomainError('VALIDATION_ERROR', `${field} supera los ${max} caracteres`, { field });
  }
  return normalized;
};

export const normalizeDni = (value: unknown): string => {
  const raw = requiredText(value, 'dni', 32);
  if (!/^[\d.\-\s]+$/.test(raw)) {
    throw new DomainError('VALIDATION_ERROR', 'El DNI solamente puede contener dígitos y separadores', { field: 'dni' });
  }
  const normalized = raw.replace(/\D/g, '');
  if (normalized.length < 6 || normalized.length > 9) {
    throw new DomainError('VALIDATION_ERROR', 'El DNI debe tener entre 6 y 9 dígitos', { field: 'dni' });
  }
  return normalized;
};

const optionalText = (value: unknown, field: string, max: number): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new DomainError('VALIDATION_ERROR', `${field} debe ser texto`, { field });
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > max) throw new DomainError('VALIDATION_ERROR', `${field} supera los ${max} caracteres`, { field });
  return normalized;
};

const birthDate = (value: unknown): Date | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainError('VALIDATION_ERROR', 'birthDate debe usar el formato AAAA-MM-DD', { field: 'birthDate' });
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value || date > new Date()) {
    throw new DomainError('VALIDATION_ERROR', 'La fecha de nacimiento no es válida o está en el futuro', { field: 'birthDate' });
  }
  return date;
};

export const validateStudentInput = (input: StudentInput) => {
  const email = optionalText(input.email, 'email', 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DomainError('VALIDATION_ERROR', 'El correo electrónico no es válido', { field: 'email' });
  }
  if (input.status !== undefined && input.status !== 'ACTIVE' && input.status !== 'INACTIVE') {
    throw new DomainError('VALIDATION_ERROR', 'El estado debe ser ACTIVE o INACTIVE', { field: 'status' });
  }
  return {
    dni: normalizeDni(input.dni),
    firstName: requiredText(input.firstName, 'firstName', 100),
    lastName: requiredText(input.lastName, 'lastName', 100),
    birthDate: birthDate(input.birthDate),
    phone: optionalText(input.phone, 'phone', 50),
    email,
    address: optionalText(input.address, 'address', 500),
    status: input.status ?? 'ACTIVE',
  };
};
