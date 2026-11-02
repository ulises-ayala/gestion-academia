import { describe, expect, it } from 'vitest';
import {
  academyShare,
  defaultSettlementPeriod,
  equalShares,
  isPeriod,
  settlementConceptLabel,
  sharesProblem,
  shiftPeriod,
} from './settlements';

describe('liquidación en la web', () => {
  it('liquida por defecto el mes anterior y se mueve de a un mes', () => {
    expect(defaultSettlementPeriod('2026-11-02')).toBe('2026-10');
    expect(defaultSettlementPeriod('2027-01-15')).toBe('2026-12');
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01');
    expect(isPeriod('2026-10')).toBe(true);
    expect(isPeriod('2026-13')).toBe(false);
  });

  it('muestra el concepto con el mes de la cuota', () => {
    expect(settlementConceptLabel({ concept: 'MONTHLY', chargePeriod: '2026-09' })).toBe(
      'Cuota septiembre de 2026',
    );
    expect(settlementConceptLabel({ concept: 'SINGLE_CLASS', chargePeriod: null })).toBe(
      'Clase suelta',
    );
  });

  it('calcula lo que queda para la academia y valida el reparto', () => {
    expect(academyShare([{ teacherId: 'a', percentage: '60' }])).toBe(40);
    expect(academyShare([{ teacherId: 'a', percentage: 'x' }])).toBeNull();
    expect(sharesProblem([{ teacherId: '', percentage: '10' }])).toMatch('profesor');
    expect(
      sharesProblem([
        { teacherId: 'a', percentage: '60' },
        { teacherId: 'b', percentage: '50,5' },
      ]),
    ).toMatch('más de 100');
    expect(sharesProblem([{ teacherId: 'a', percentage: '33,33' }])).toBeNull();
  });

  it('reparte en partes iguales con Dirección como una parte más (Formación: 20% cada uno)', () => {
    expect(equalShares(['a', 'b', 'c', 'd'], true).map((row) => row.percentage)).toEqual([
      '20',
      '20',
      '20',
      '20',
    ]);
    expect(equalShares(['a', 'b'], true).map((row) => row.percentage)).toEqual(['33,33', '33,33']);
  });
});
