import { Prisma } from '@academy/database';
import { describe, expect, it } from 'vitest';
import { buildReallocationPlan, netAllocations } from './payment-allocation';

const d = (value: string) => new Prisma.Decimal(value);
const row = (monthlyChargeId: string, amount: string) => ({ monthlyChargeId, amount: d(amount) });
const charge = (id: string, due: string, paid: string) => ({
  id,
  studentDueAmount: d(due),
  paid: d(paid),
});
const plain = (rows: readonly { monthlyChargeId: string; amount: Prisma.Decimal }[]) =>
  rows.map(({ monthlyChargeId, amount }) => [monthlyChargeId, amount.toFixed(2)]);

describe('imputación vigente de un pago', () => {
  it('suma la original con las reimputaciones y oculta las cuotas en cero', () => {
    expect(
      plain(
        netAllocations([
          row('sep', '40000'),
          row('sep', '-40000'),
          row('oct', '40000'),
          row('oct', '-10000'),
          row('nov', '10000'),
        ]),
      ),
    ).toEqual([
      ['oct', '30000.00'],
      ['nov', '10000.00'],
    ]);
  });
});

describe('reimputar un pago', () => {
  const current = [row('sep', '40000')];

  it('pasa el pago de septiembre a octubre sin cambiar el total', () => {
    const plan = buildReallocationPlan(
      d('40000'),
      current,
      [row('oct', '40000')],
      [charge('sep', '40000', '40000'), charge('oct', '40000', '0')],
    );
    expect(plain(plan)).toEqual([
      ['sep', '-40000.00'],
      ['oct', '40000.00'],
    ]);
  });

  it('reparte entre dos cuotas', () => {
    const plan = buildReallocationPlan(
      d('40000'),
      current,
      [row('sep', '10000'), row('oct', '30000')],
      [charge('sep', '40000', '40000'), charge('oct', '40000', '0')],
    );
    expect(plain(plan)).toEqual([
      ['sep', '-30000.00'],
      ['oct', '30000.00'],
    ]);
  });

  it('las cuotas no suman más que el pago; lo que no se imputa queda como saldo a favor', () => {
    expect(() =>
      buildReallocationPlan(
        d('40000'),
        current,
        [row('oct', '40000.01')],
        [charge('oct', '50000', '0')],
      ),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    const plan = buildReallocationPlan(
      d('40000'),
      current,
      [row('oct', '30000')],
      [charge('oct', '40000', '0')],
    );
    const total = plan.reduce((sum, item) => sum.plus(item.amount), d('0'));
    // La imputación vigente baja 10.000: ese importe pasa a saldo a favor.
    expect(total.toFixed(2)).toBe('-10000.00');
  });

  it('un pago duplicado se desimputa entero a saldo a favor', () => {
    const plan = buildReallocationPlan(d('40000'), current, [], []);
    expect(plan.every((item) => item.amount.isNegative())).toBe(true);
  });

  it('no deja pagar de más una cuota (otro pago ya cubre parte)', () => {
    expect(() =>
      buildReallocationPlan(
        d('40000'),
        current,
        [row('oct', '40000')],
        [charge('sep', '40000', '40000'), charge('oct', '40000', '15000')],
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE',
        details: { monthlyChargeId: 'oct', outstandingAmount: '25000.00' },
      }),
    );
  });

  it('rechaza una cuota que no es del alumno', () => {
    expect(() =>
      buildReallocationPlan(
        d('40000'),
        current,
        [row('ajena', '40000')],
        [charge('sep', '40000', '40000')],
      ),
    ).toThrow(expect.objectContaining({ code: 'MONTHLY_CHARGE_NOT_FOUND' }));
  });

  it('rechaza si la imputación queda igual', () => {
    expect(() =>
      buildReallocationPlan(
        d('40000'),
        current,
        [row('sep', '40000')],
        [charge('sep', '40000', '40000')],
      ),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
