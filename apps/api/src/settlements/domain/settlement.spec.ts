import { Prisma } from '@academy/database';
import { describe, expect, it } from 'vitest';
import {
  computeSettlement,
  planFor,
  validateShares,
  type ChargeIncome,
  type SettlementPlan,
  type SingleClassIncome,
} from './settlement';

const d = (value: string | number) => new Prisma.Decimal(value);
const paidAt = new Date('2026-10-15T15:00:00.000Z');
const charge = (overrides: Partial<ChargeIncome> = {}): ChargeIncome => ({
  paymentId: 'p1',
  paidAt,
  studentName: 'Ana Pérez',
  classId: 'zumba',
  className: 'Zumba',
  chargeKind: 'MONTHLY',
  chargePeriod: '2026-10',
  collected: d(40000),
  studentDue: d(40000),
  settlementBase: d(40000),
  ...overrides,
});
const single = (overrides: Partial<SingleClassIncome> = {}): SingleClassIncome => ({
  paymentId: 's1',
  paidAt,
  studentName: 'Luis Sol',
  classId: 'zumba',
  className: 'Zumba',
  teacherId: 'joselo',
  collected: d(5000),
  ...overrides,
});
const zumba: SettlementPlan = {
  classId: 'zumba',
  validFrom: '2026-01',
  shares: [{ teacherId: 'joselo', percentage: d(60) }],
};
const formacion: SettlementPlan = {
  classId: 'formacion',
  validFrom: '2026-01',
  shares: ['a', 'b', 'c', 'd'].map((teacherId) => ({ teacherId, percentage: d(20) })),
};
const settle = (
  input: Partial<Parameters<typeof computeSettlement>[0]>,
): ReturnType<typeof computeSettlement> =>
  computeSettlement({
    charges: [],
    singleClasses: [],
    otherIncome: d(0),
    plans: [zumba, formacion],
    period: '2026-10',
    ...input,
  });
const totalOf = (result: ReturnType<typeof computeSettlement>, teacherId: string) =>
  result.teachers.find((item) => item.teacherId === teacherId)?.total.toFixed(2) ?? '0.00';

describe('Liquidación de profesores', () => {
  it('liquida el porcentaje del profesor sobre lo cobrado y el resto queda en la academia', () => {
    const result = settle({ charges: [charge()] });
    expect(totalOf(result, 'joselo')).toBe('24000.00');
    expect(result.academy.toFixed(2)).toBe('16000.00');
    expect(result.teachers[0]!.lines[0]).toMatchObject({ concept: 'MONTHLY' });
  });

  it('reparte la Formación en cinco partes: 20% a cada profesor y 20% a Dirección', () => {
    const result = settle({
      charges: [
        charge({ classId: 'formacion', className: 'Formación', collected: d(30000) }),
        charge({
          paymentId: 'p2',
          classId: 'formacion',
          className: 'Formación',
          collected: d(30000),
        }),
      ].map((item) => ({ ...item, studentDue: d(30000), settlementBase: d(30000) })),
    });
    for (const teacher of ['a', 'b', 'c', 'd']) expect(totalOf(result, teacher)).toBe('12000.00');
    expect(result.academy.toFixed(2)).toBe('12000.00');
  });

  it('con beca de Dirección el profesor cobra sobre la cuota completa', () => {
    const result = settle({
      charges: [charge({ collected: d(20000), studentDue: d(20000), settlementBase: d(40000) })],
    });
    expect(totalOf(result, 'joselo')).toBe('24000.00');
    expect(result.academy.toFixed(2)).toBe('-4000.00');
  });

  it('un pago parcial liquida en proporción y el descuento docente baja la base', () => {
    const partial = settle({ charges: [charge({ collected: d(10000) })] });
    const discounted = settle({
      charges: [charge({ collected: d(30000), studentDue: d(30000), settlementBase: d(30000) })],
    });
    expect(totalOf(partial, 'joselo')).toBe('6000.00');
    expect(totalOf(discounted, 'joselo')).toBe('18000.00');
  });

  it('una cuota atrasada se liquida en el mes del cobro con el reparto del mes de la cuota', () => {
    const plans: SettlementPlan[] = [
      {
        classId: 'zumba',
        validFrom: '2026-09',
        shares: [{ teacherId: 'joselo', percentage: d(60) }],
      },
      {
        classId: 'zumba',
        validFrom: '2026-11',
        shares: [{ teacherId: 'mariana', percentage: d(50) }],
      },
    ];
    const result = settle({
      plans,
      period: '2026-11',
      charges: [charge({ chargePeriod: '2026-10', paidAt: new Date('2026-11-05T15:00:00Z') })],
    });
    expect(totalOf(result, 'joselo')).toBe('24000.00');
    expect(totalOf(result, 'mariana')).toBe('0.00');
  });

  it('un reparto sin profesores deja todo a la academia (Formación en diciembre)', () => {
    const result = settle({
      period: '2026-12',
      plans: [formacion, { classId: 'formacion', validFrom: '2026-12', shares: [] }],
      charges: [charge({ classId: 'formacion', chargePeriod: '2026-12' })],
    });
    expect(result.teachers).toEqual([]);
    expect(result.unconfigured).toEqual([]);
    expect(result.academy.toFixed(2)).toBe('40000.00');
  });

  it('avisa las clases cobradas sin reparto y deja ese dinero en la academia', () => {
    const result = settle({
      plans: [],
      charges: [charge(), charge({ paymentId: 'p2', collected: d(1000) })],
    });
    expect(result.teachers).toEqual([]);
    expect(result.unconfigured).toEqual([
      { classId: 'zumba', className: 'Zumba', period: '2026-10', collected: d(41000) },
    ]);
    expect(result.academy.toFixed(2)).toBe('41000.00');
  });

  it('la clase suelta va al profesor que la dictó; un reemplazo se lleva la parte de la clase', () => {
    const own = settle({ singleClasses: [single()] });
    const replacement = settle({ singleClasses: [single({ teacherId: 'sofia' })] });
    expect(totalOf(own, 'joselo')).toBe('3000.00');
    expect(totalOf(replacement, 'sofia')).toBe('3000.00');
    expect(totalOf(replacement, 'joselo')).toBe('0.00');
  });

  it('los otros cobros (remeras, vestuario) son de la academia', () => {
    const result = settle({ charges: [charge()], otherIncome: d(15000) });
    expect(result.collected.toFixed(2)).toBe('55000.00');
    expect(result.classIncome.toFixed(2)).toBe('40000.00');
    expect(result.academy.toFixed(2)).toBe('31000.00');
  });

  it('elige el reparto vigente más reciente', () => {
    const plans: SettlementPlan[] = [
      { classId: 'x', validFrom: '2026-08', shares: [] },
      { classId: 'x', validFrom: '2026-10', shares: [] },
      { classId: 'x', validFrom: '2026-12', shares: [] },
    ];
    expect(planFor(plans, 'x', '2026-11')?.validFrom).toBe('2026-10');
    expect(planFor(plans, 'x', '2026-07')).toBeNull();
  });
});

describe('Validación del reparto', () => {
  it('acepta porcentajes con coma o punto y hasta 100 en total', () => {
    expect(
      validateShares([
        { teacherId: 'a', percentage: '33,33' },
        { teacherId: 'b', percentage: '66.67' },
      ]).map((share) => share.percentage.toFixed(2)),
    ).toEqual(['33.33', '66.67']);
    expect(validateShares([])).toEqual([]);
  });

  it('rechaza profesores repetidos, porcentajes fuera de rango y totales mayores a 100', () => {
    expect(() =>
      validateShares([
        { teacherId: 'a', percentage: '10' },
        { teacherId: 'a', percentage: '10' },
      ]),
    ).toThrow('dos veces');
    expect(() => validateShares([{ teacherId: 'a', percentage: '0' }])).toThrow('de 0 a 100');
    expect(() => validateShares([{ teacherId: 'a', percentage: 'abc' }])).toThrow('no es válido');
    expect(() =>
      validateShares([
        { teacherId: 'a', percentage: '60' },
        { teacherId: 'b', percentage: '50' },
      ]),
    ).toThrow('más de 100');
  });
});
