import { Prisma } from '@academy/database';
import { describe, expect, it } from 'vitest';
import {
  allocatableAmount,
  assertRefundFits,
  buildCreditApplicationPlan,
  buildCreditUsePlan,
  paymentCredit,
} from './payment-credit';

const d = (value: string) => new Prisma.Decimal(value);
const rows = (...values: string[]) => values.map((value) => ({ amount: d(value) }));

describe('saldo a favor', () => {
  it('es lo cobrado que no está imputado ni devuelto', () => {
    expect(paymentCredit(d('50000'), rows('40000'), []).toFixed(2)).toBe('10000.00');
    // Una reimputación suma filas negativas y positivas: cuenta la imputación vigente.
    expect(paymentCredit(d('40000'), rows('40000', '-40000'), []).toFixed(2)).toBe('40000.00');
    expect(paymentCredit(d('50000'), rows('40000'), rows('4000')).toFixed(2)).toBe('6000.00');
    expect(paymentCredit(d('40000'), rows('40000'), []).toFixed(2)).toBe('0.00');
  });

  it('lo devuelto ya no se puede imputar', () => {
    expect(allocatableAmount(d('50000'), rows('10000')).toFixed(2)).toBe('40000.00');
  });

  it('usa el saldo de los pagos en las cuotas pendientes, de la más vieja a la más nueva', () => {
    const charge = (id: string, due: string, paid = '0') => ({
      id,
      studentDueAmount: d('40000'),
      dueDate: new Date(due),
      createdAt: new Date(due),
      allocations: rows(paid),
    });
    const plan = buildCreditApplicationPlan(
      [
        { paymentId: 'p1', credit: d('8000') },
        { paymentId: 'p2', credit: d('35000') },
      ],
      [charge('dic', '2026-12-10'), charge('nov', '2026-11-10', '30000')],
    );
    expect(
      plan.map(({ paymentId, allocations }) => [
        paymentId,
        allocations.map((row) => [row.monthlyChargeId, row.amount.toFixed(2)]),
      ]),
    ).toEqual([
      ['p1', [['nov', '8000.00']]],
      [
        'p2',
        [
          ['nov', '2000.00'],
          ['dic', '33000.00'],
        ],
      ],
    ]);
    expect(() => buildCreditApplicationPlan([{ paymentId: 'p1', credit: d('8000') }], [])).toThrow(
      expect.objectContaining({ code: 'PAYMENT_NO_CREDIT' }),
    );
  });

  it('no se devuelve más que el saldo a favor', () => {
    expect(() => assertRefundFits(d('1000'), d('0'))).toThrow(
      expect.objectContaining({ code: 'PAYMENT_NO_CREDIT' }),
    );
    expect(() => assertRefundFits(d('10000.01'), d('10000'))).toThrow(
      expect.objectContaining({ code: 'PAYMENT_REFUND_EXCEEDS_CREDIT' }),
    );
    expect(() => assertRefundFits(d('10000'), d('10000'))).not.toThrow();
  });

  it('usa el saldo de los pagos del más viejo al más nuevo y no deja pasarse', () => {
    const plan = buildCreditUsePlan(
      [
        { paymentId: 'viejo', credit: d('3000') },
        { paymentId: 'sin-saldo', credit: d('0') },
        { paymentId: 'nuevo', credit: d('10000') },
      ],
      d('5000'),
    );
    expect(plan.map((row) => [row.sourcePaymentId, row.amount.toFixed(2)])).toEqual([
      ['viejo', '3000.00'],
      ['nuevo', '2000.00'],
    ]);
    expect(() => buildCreditUsePlan([{ paymentId: 'p', credit: d('3000') }], d('3000.01'))).toThrow(
      expect.objectContaining({
        code: 'PAYMENT_EXCEEDS_CREDIT',
        details: { field: 'creditAmount', creditAmount: '3000.00' },
      }),
    );
  });
});
