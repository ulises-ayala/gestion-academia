import { describe, expect, it } from 'vitest';
import { dailySeries, dayLabelStep, reportTab } from './reports';

describe('reportes', () => {
  it('resuelve la pestaña de la URL y cae en Resumen', () => {
    expect(reportTab('debtors')).toBe('debtors');
    expect(reportTab('teachers')).toBe('teachers');
    expect(reportTab(null)).toBe('summary');
    expect(reportTab('otra')).toBe('summary');
  });

  it('completa con cero los días sin cobros', () => {
    expect(
      dailySeries('2026-11-01', '2026-11-04', [
        { date: '2026-11-02', amount: '40000.00' },
        { date: '2026-11-04T00:00:00.000Z', amount: '1000.00' },
      ]),
    ).toEqual([
      { date: '2026-11-01', amount: 0 },
      { date: '2026-11-02', amount: 40000 },
      { date: '2026-11-03', amount: 0 },
      { date: '2026-11-04', amount: 1000 },
    ]);
  });

  it('en períodos largos deja solo los días con cobros', () => {
    const series = dailySeries('2026-01-01', '2026-06-30', [
      { date: '2026-03-10', amount: '500.00' },
    ]);
    expect(series).toEqual([{ date: '2026-03-10', amount: 500 }]);
  });

  it('espacia los rótulos de los días', () => {
    expect(dayLabelStep(10)).toBe(1);
    expect(dayLabelStep(31)).toBe(2);
  });
});
