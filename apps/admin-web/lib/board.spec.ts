import { describe, expect, it } from 'vitest';
import {
  amountDelta,
  barWidth,
  classOccupancy,
  countDelta,
  shareOf,
  shiftMonth,
  chartScale,
  chartX,
  chartY,
  linePath,
  paceComparison,
  shareShift,
} from './board';

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

  it('arma un eje de tres marcas redondas', () => {
    expect(chartScale([160, 172, 184], false).ticks).toEqual([160, 180, 200]);
    expect(chartScale([0, 7_240_000], true).ticks).toEqual([0, 4_000_000, 8_000_000]);
    expect(chartScale([3, 3], false).ticks).toEqual([3, 4, 5]);
    expect(chartScale([0, 0], true).ticks).toEqual([0, 1, 2]);
  });

  it('traza la línea y la corta en los huecos', () => {
    const scale = { low: 0, high: 10 };
    expect(linePath([0, 10, null, 5], 4, scale)).toBe('M0.00 100.00L33.33 0.00M100.00 50.00');
    expect(chartX(0, 1)).toBe(50);
    expect(chartY(5, scale)).toBe(50);
  });

  it('compara el ritmo de cobro al mismo día del mes anterior', () => {
    expect(paceComparison(['10', '30'], ['5', '20', '90'])).toEqual({
      day: 2,
      current: 30,
      previousSameDay: 20,
      previousTotal: 90,
    });
    // Mes más largo que el anterior: se compara contra su cierre.
    expect(paceComparison(['1', '2', '3'], ['4', '8']).previousSameDay).toBe(8);
  });

  it('expresa el cambio de participación en puntos', () => {
    expect(shareShift(43, 40)).toBe('▲ 3 pts');
    expect(shareShift(39, 40)).toBe('▼ 1 pt');
    expect(shareShift(40, 40)).toBe('igual');
    expect(shareShift(40, null)).toBeNull();
  });
});
