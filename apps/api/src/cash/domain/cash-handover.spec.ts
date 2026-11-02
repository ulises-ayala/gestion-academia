import { describe, expect, it } from 'vitest';
import { periodsOverlap, validateCashHandover } from './cash-handover';

const today = '2026-11-08';

describe('entrega de efectivo a Dirección', () => {
  it('normaliza la entrega y por defecto la recibe Dirección', () => {
    const handover = validateCashHandover(
      { fromDate: '2026-11-02', toDate: '2026-11-08', amount: '350000', note: '  semana 1 ' },
      today,
    );
    expect(handover).toMatchObject({
      fromDate: '2026-11-02',
      toDate: '2026-11-08',
      receivedBy: 'Dirección',
      note: 'semana 1',
    });
    expect(handover.amount.toFixed(2)).toBe('350000.00');
  });

  it.each([
    [{ fromDate: '2026-11-09', toDate: '2026-11-02', amount: '1' }, 'toDate'],
    [{ fromDate: '2026-11-02', toDate: '2026-11-09', amount: '1' }, 'toDate'],
    [{ fromDate: '2026-02-30', toDate: '2026-11-02', amount: '1' }, 'fromDate'],
    [{ fromDate: '2026-11-02', toDate: '2026-11-08', amount: '0' }, 'amount'],
    [{ fromDate: '2026-11-02', toDate: '2026-11-08', amount: '-5' }, 'amount'],
  ])('rechaza %j', (input, field) => {
    expect(() => validateCashHandover(input, today)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR', details: { field } }),
    );
  });

  it('detecta períodos que comparten días', () => {
    const week = { fromDate: '2026-11-02', toDate: '2026-11-08' };
    expect(periodsOverlap(week, { fromDate: '2026-11-08', toDate: '2026-11-14' })).toBe(true);
    expect(periodsOverlap(week, { fromDate: '2026-11-09', toDate: '2026-11-15' })).toBe(false);
  });
});
