import { describe, expect, it } from 'vitest';
import { sanitizeAuditSnapshot, validateReason } from './audit';

describe('audit safety', () => {
  it('elimina secretos en cualquier nivel del snapshot', () => {
    const result = sanitizeAuditSnapshot({
      username: 'maria',
      passwordHash: 'secret',
      nested: { tokenHash: 'secret', role: 'MANAGER' },
    });
    expect(JSON.stringify(result)).not.toMatch(/password|token|secret/i);
    expect(result).toMatchObject({ username: 'maria', nested: { role: 'MANAGER' } });
  });
  it('exige un motivo real y lo normaliza', () => {
    expect(validateReason('  Pago duplicado  ')).toBe('Pago duplicado');
    expect(() => validateReason('   ')).toThrowError(/obligatorio/i);
  });
});
