import { DomainError } from '../../shared/domain/domain-error';

export const AUDIT_ACTIONS = {
  UPDATE: 'UPDATE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  VOID: 'VOID',
  END: 'END',
  CORRECTION: 'CORRECTION',
  ROLE_CHANGE: 'ROLE_CHANGE',
} as const;
export const AUDIT_ENTITY_TYPES = {
  STUDENT: 'STUDENT',
  LEAD: 'LEAD',
  TEACHER: 'TEACHER',
  DANCE_TYPE: 'DANCE_TYPE',
  BRANCH: 'BRANCH',
  ROOM: 'ROOM',
  ACADEMY_CLASS: 'ACADEMY_CLASS',
  TARIFF: 'TARIFF',
  ADMIN_USER: 'ADMIN_USER',
  PAYMENT: 'PAYMENT',
  ATTENDANCE: 'ATTENDANCE',
  ENROLLMENT: 'ENROLLMENT',
} as const;

const forbidden =
  /password|passwordhash|token|tokenhash|secret|authorization|cookie|database_url|private.?key/i;
export const sanitizeAuditSnapshot = (value: unknown): Record<string, unknown> | null => {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return { items: value.map((item) => sanitizeValue(item)) };
  if (typeof value !== 'object') return { value: sanitizeValue(value) };
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !forbidden.test(key))
      .map(([key, item]) => [key, sanitizeValue(item)]),
  );
};
const sanitizeValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') return sanitizeAuditSnapshot(value);
  return value;
};

export const validateReason = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim())
    throw new DomainError('VALIDATION_ERROR', 'El motivo es obligatorio', { field: 'reason' });
  const reason = value.trim();
  if (reason.length > 500)
    throw new DomainError('VALIDATION_ERROR', 'El motivo no puede superar los 500 caracteres', {
      field: 'reason',
    });
  return reason;
};
