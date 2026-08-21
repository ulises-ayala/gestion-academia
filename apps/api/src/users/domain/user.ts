import { DomainError } from '../../shared/domain/domain-error';

export const normalizeAdminUsername = (value: unknown): string => {
  if (typeof value !== 'string')
    throw new DomainError('VALIDATION_ERROR', 'El usuario es obligatorio', { field: 'username' });
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,100}$/.test(username))
    throw new DomainError(
      'VALIDATION_ERROR',
      'El usuario debe tener entre 3 y 100 caracteres y usar letras, números, punto, guion o guion bajo',
      { field: 'username' },
    );
  return username;
};
