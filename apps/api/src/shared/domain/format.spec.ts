import { describe, expect, it } from 'vitest';
import { PAYMENT_METHOD_LABELS, formatDate, formatDayMonth, formatMoney } from './format';

describe('formatos compartidos', () => {
  it('nombra los cuatro medios de pago', () => {
    expect(Object.values(PAYMENT_METHOD_LABELS)).toEqual([
      'Efectivo',
      'Mercado Pago',
      'Transferencia',
      'Tarjeta',
    ]);
  });

  it('formatea pesos con centavos', () => {
    expect(formatMoney('40000')).toMatch(/\$\s?40\.000,00/);
    expect(formatMoney(1234.5)).toMatch(/\$\s?1\.234,50/);
  });

  it('formatea fechas de día', () => {
    expect(formatDate('2026-10-05')).toBe('05/10/2026');
    expect(formatDate('2026-10-05T23:00:00.000Z')).toBe('05/10/2026');
    expect(formatDayMonth('2026-10-05')).toBe('05/10');
  });
});
