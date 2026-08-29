import { describe, expect, it } from 'vitest';
import {
  formatAuditAction,
  formatAuditEntity,
  formatAuditField,
  formatAuditValue,
  getChangedAuditFields,
} from './audit-presentation';

describe('audit presentation', () => {
  it('traduce entidades, acciones, campos y valores conocidos', () => {
    expect(formatAuditEntity('ACADEMY_CLASS')).toBe('Clase');
    expect(formatAuditAction('VOID')).toBe('Anulación');
    expect(formatAuditField('validFrom')).toBe('Vigente desde');
    expect(formatAuditValue('status', 'CONFIRMED')).toBe('Confirmado');
    expect(formatAuditValue('role', 'MANAGER')).toBe('Administración');
  });
  it('formatea dinero, fechas y nulos para negocio', () => {
    expect(formatAuditValue('amount', '40000.00')).toMatch(/40[.\s]000,00/);
    expect(formatAuditValue('endDate', '2026-08-29')).toBe('29/8/2026');
    expect(formatAuditValue('notes', null)).toBe('—');
  });
  it('devuelve solamente los campos modificados', () => {
    expect(
      getChangedAuditFields({
        before: { name: 'Ana', phone: '111' },
        after: { name: 'Ana', phone: '222' },
      }),
    ).toEqual([{ field: 'phone', label: 'Teléfono', before: '111', after: '222' }]);
  });
});
