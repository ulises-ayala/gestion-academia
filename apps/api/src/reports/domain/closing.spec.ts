import type { ClosingFiguresDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import { closingChanges, closingPeriod, monthRange, nextClosingPeriod } from './closing';

const methods = (cash: string, card = '0.00') => [
  { method: 'CASH' as const, amount: cash },
  { method: 'CARD' as const, amount: card },
];
const figures = (cash: string, refund = '0.00'): ClosingFiguresDto => ({
  collections: {
    total: cash,
    byMethod: methods(cash),
    byConceptAndMethod: [
      { concept: 'CHARGES', label: 'Cuotas', byMethod: methods(cash), total: cash },
    ],
  },
  refunds: { total: refund, byMethod: methods(refund) },
  students: null,
});

describe('cierres de la recaudación', () => {
  it('propone la semana siguiente al último cierre y el mes siguiente al último mes', () => {
    expect(nextClosingPeriod('WEEKLY', '2026-11-01', '2026-11-10')).toEqual({
      fromDate: '2026-11-02',
      toDate: '2026-11-08',
      closable: true,
      reason: null,
    });
    expect(nextClosingPeriod('WEEKLY', null, '2026-11-10')).toMatchObject({
      fromDate: '2026-11-04',
      toDate: '2026-11-10',
    });
    expect(nextClosingPeriod('WEEKLY', '2026-11-10', '2026-11-10')).toMatchObject({
      closable: false,
    });
    expect(nextClosingPeriod('MONTHLY', null, '2026-11-03')).toEqual({
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
      closable: true,
      reason: null,
    });
    expect(nextClosingPeriod('MONTHLY', '2026-10-31', '2026-11-03')).toMatchObject({
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
      closable: false,
    });
    expect(monthRange('2028-02')).toEqual({ fromDate: '2028-02-01', toDate: '2028-02-29' });
  });

  it('valida el período: semana de hasta 31 días sin futuro, mes ya terminado', () => {
    expect(
      closingPeriod({ kind: 'WEEKLY', fromDate: '2026-11-02', toDate: '2026-11-08' }, '2026-11-08'),
    ).toEqual({ kind: 'WEEKLY', fromDate: '2026-11-02', toDate: '2026-11-08' });
    expect(() =>
      closingPeriod({ kind: 'WEEKLY', fromDate: '2026-11-02', toDate: '2026-11-09' }, '2026-11-08'),
    ).toThrow(expect.objectContaining({ details: { field: 'toDate' } }));
    expect(() =>
      closingPeriod({ kind: 'WEEKLY', fromDate: '2026-10-01', toDate: '2026-11-02' }, '2026-11-08'),
    ).toThrow(expect.objectContaining({ details: { field: 'toDate' } }));
    expect(closingPeriod({ kind: 'MONTHLY', month: '2026-10' }, '2026-11-01')).toEqual({
      kind: 'MONTHLY',
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
    });
    expect(() => closingPeriod({ kind: 'MONTHLY', month: '2026-11' }, '2026-11-30')).toThrow(
      expect.objectContaining({ details: { field: 'month' } }),
    );
  });

  it('registra aparte lo que cambió después del cierre', () => {
    expect(closingChanges(figures('100000.00'), figures('100000.00'))).toEqual([]);
    expect(closingChanges(figures('100000.00'), figures('60000.00', '5000.00'))).toEqual([
      {
        concept: 'CHARGES',
        label: 'Cuotas',
        method: 'CASH',
        original: '100000.00',
        current: '60000.00',
        difference: '-40000.00',
      },
      {
        concept: 'REFUNDS',
        label: 'Devoluciones',
        method: 'CASH',
        original: '0.00',
        current: '5000.00',
        difference: '5000.00',
      },
    ]);
  });
});
