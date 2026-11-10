import { describe, expect, it } from 'vitest';
import { amountDelta, barWidth, classOccupancy, countDelta, shareOf, shiftMonth } from './board';

describe('tablero mensual', () => {
  it('cambia de mes cruzando el año', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('marca si la diferencia es buena o mala según el indicador', () => {
    expect(countDelta(184, 178, true)).toEqual({ text: '▲ 6', tone: 'good' });
    expect(countDelta(8, 6, false)).toEqual({ text: '▲ 2', tone: 'bad' });
    expect(countDelta(4, 6, false)).toEqual({ text: '▼ 2', tone: 'good' });
    expect(countDelta(5, 5, true)).toEqual({ text: 'Igual', tone: 'flat' });
  });

  it('calcula la variación de un importe y no compara contra cero', () => {
    expect(amountDelta('108400.00', '100000.00')).toEqual({ text: '▲ 8,4 %', tone: 'good' });
    expect(amountDelta('90000.00', '100000.00')).toEqual({ text: '▼ 10,0 %', tone: 'bad' });
    expect(amountDelta('5000.00', '0.00')).toBeNull();
  });

  it('clasifica la ocupación de una clase', () => {
    expect(classOccupancy(6, 20)).toEqual({ percent: 30, width: 30, level: 'low' });
    expect(classOccupancy(11, 20)).toEqual({ percent: 55, width: 55, level: null });
    expect(classOccupancy(26, 24)).toEqual({ percent: 108, width: 100, level: 'full' });
  });

  it('dimensiona barras y partes de un total', () => {
    expect(barWidth(50, 200)).toBe(25);
    expect(barWidth(1, 1000)).toBe(2);
    expect(barWidth(0, 1000)).toBe(0);
    expect(shareOf(43, 100)).toBe(43);
    expect(shareOf(1, 0)).toBeNull();
  });
});
