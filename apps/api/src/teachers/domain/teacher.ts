import { DomainError } from '../../shared/domain/domain-error';

export type TeacherStatus = 'ACTIVE' | 'INACTIVE';
export type TeacherData = Readonly<{ id: string; dni: string; firstName: string; lastName: string; phone: string | null; email: string | null; address: string | null; status: TeacherStatus; createdAt: Date; updatedAt: Date }>;
export type TeacherInput = Readonly<{ dni: string; firstName: string; lastName: string; phone?: string | null; email?: string | null; address?: string | null; status?: TeacherStatus }>;

const text = (value: unknown, field: string, max: number) => {
  if (typeof value !== 'string' || !value.trim()) throw new DomainError('VALIDATION_ERROR', `${field} es obligatorio`, { field });
  const result = value.trim();
  if (result.length > max) throw new DomainError('VALIDATION_ERROR', `${field} supera los ${max} caracteres`, { field });
  return result;
};
const optional = (value: unknown, field: string, max: number) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new DomainError('VALIDATION_ERROR', `${field} debe ser texto`, { field });
  const result = value.trim();
  if (!result) return null;
  if (result.length > max) throw new DomainError('VALIDATION_ERROR', `${field} supera los ${max} caracteres`, { field });
  return result;
};
export const normalizeTeacherDni = (value: unknown) => {
  const raw = text(value, 'dni', 32);
  if (!/^[\d.\-\s]+$/.test(raw)) throw new DomainError('VALIDATION_ERROR', 'El DNI solamente puede contener dígitos y separadores', { field: 'dni' });
  const dni = raw.replace(/\D/g, '');
  if (dni.length < 6 || dni.length > 9) throw new DomainError('VALIDATION_ERROR', 'El DNI debe tener entre 6 y 9 dígitos', { field: 'dni' });
  return dni;
};
export const validateTeacher = (input: TeacherInput) => {
  const email = optional(input.email, 'email', 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError('VALIDATION_ERROR', 'El correo electrónico no es válido', { field: 'email' });
  if (input.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(input.status)) throw new DomainError('VALIDATION_ERROR', 'Estado inválido', { field: 'status' });
  return { dni: normalizeTeacherDni(input.dni), firstName: text(input.firstName, 'firstName', 100), lastName: text(input.lastName, 'lastName', 100), phone: optional(input.phone, 'phone', 50), email, address: optional(input.address, 'address', 500), status: input.status ?? 'ACTIVE' };
};
