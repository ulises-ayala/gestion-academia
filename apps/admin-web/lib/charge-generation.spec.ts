import { describe, expect, it } from 'vitest';
import {
  addMonths,
  businessPeriod,
  collectNowAmount,
  inactiveTariffsFrom,
  periodLabel,
  periodRange,
  suggestedPeriod,
} from './charge-generation';

describe('generar cuota', () => {
  it('toma el mes de Buenos Aires', () => {
    expect(businessPeriod(new Date('2026-11-01T02:00:00Z'))).toBe('2026-10');
    expect(businessPeriod(new Date('2026-11-01T04:00:00Z'))).toBe('2026-11');
  });
  it('suma meses cruzando el año', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });
  it('Admisión elige desde el mes actual; Administración desde el inicio de la inscripción', () => {
    const base = { currentPeriod: '2026-10', enrollmentStart: '2026-03-02' };
    expect(periodRange({ ...base, canBackfill: false })).toEqual({
      min: '2026-10',
      max: '2026-12',
    });
    expect(periodRange({ ...base, canBackfill: true })).toEqual({ min: '2026-03', max: '2026-12' });
    expect(
      periodRange({ currentPeriod: '2026-10', enrollmentStart: '2026-11-01', canBackfill: false }),
    ).toEqual({ min: '2026-11', max: '2026-12' });
  });
  it('sugiere el primer mes sin cuota desde el actual', () => {
    const range = { min: '2026-03', max: '2026-12' };
    expect(suggestedPeriod(range, '2026-10', new Set())).toBe('2026-10');
    expect(suggestedPeriod(range, '2026-10', new Set(['2026-10']))).toBe('2026-11');
    expect(suggestedPeriod(range, '2026-10', new Set(['2026-10', '2026-11', '2026-12']))).toBe(
      '2026-12',
    );
  });
  it('al cobrar en el momento suma el recargo si la cuota ya venció', () => {
    expect(collectNowAmount({ studentDueAmount: '40000.00', lateFeeOnCollect: false })).toBe(
      '40000.00',
    );
    expect(collectNowAmount({ studentDueAmount: '40000.00', lateFeeOnCollect: true })).toBe(
      '41000.00',
    );
  });
  it('lee las tarifas desactivadas que se pueden activar', () => {
    const tariff = { id: 't1', name: 'Zumba mensual', amount: '40000.00' };
    expect(
      inactiveTariffsFrom({
        code: 'TARIFF_NOT_FOUND_FOR_PERIOD',
        details: { inactiveTariffs: [tariff, { id: 3 }] },
      }),
    ).toEqual([tariff]);
    expect(inactiveTariffsFrom({ code: 'TARIFF_NOT_FOUND_FOR_PERIOD', details: {} })).toEqual([]);
    expect(inactiveTariffsFrom({ code: 'OTRO', details: { inactiveTariffs: [tariff] } })).toEqual(
      [],
    );
  });
  it('nombra el mes en castellano', () => {
    expect(periodLabel('2026-11')).toBe('Noviembre de 2026');
  });
});
