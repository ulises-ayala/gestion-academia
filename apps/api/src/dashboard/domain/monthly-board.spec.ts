import { describe, expect, it } from 'vitest';
import { DomainError } from '../../shared/domain/domain-error';
import { boardMonth, boardMonths, percentOf } from './monthly-board';

describe('tablero mensual: meses', () => {
  it('usa el mes actual por defecto y rechaza meses inválidos o futuros', () => {
    expect(boardMonth(undefined, '2026-11-10')).toBe('2026-11');
    expect(boardMonth('2026-10', '2026-11-10')).toBe('2026-10');
    expect(() => boardMonth('2026-13', '2026-11-10')).toThrow(DomainError);
    expect(() => boardMonth('2026-12', '2026-11-10')).toThrow('todavía no empezó');
  });

  it('arma los seis meses hasta el pedido, cruzando el año', () => {
    const months = boardMonths('2026-02', '2026-11-10');
    expect(months.map((item) => item.month)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(months.at(-1)).toEqual({
      month: '2026-02',
      label: 'Febrero 2026',
      shortLabel: 'Feb',
      fromDate: '2026-02-01',
      toDate: '2026-02-28',
      refDate: '2026-02-28',
      nextDate: '2026-03-01',
    });
  });

  it('en el mes en curso cuenta los activos a hoy', () => {
    const current = boardMonths('2026-11', '2026-11-10').at(-1)!;
    expect(current.toDate).toBe('2026-11-30');
    expect(current.refDate).toBe('2026-11-10');
  });

  it('calcula porcentajes enteros y null sin total', () => {
    expect(percentOf(7, 9)).toBe(78);
    expect(percentOf(0, 0)).toBeNull();
  });
});
