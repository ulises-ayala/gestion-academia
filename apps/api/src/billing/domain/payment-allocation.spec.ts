import { Prisma } from '@academy/database';
import { describe, expect, it } from 'vitest';
import { buildPaymentAllocationPlan, paymentChargeStatus } from './payment-allocation';

const decimal = (value: string) => new Prisma.Decimal(value);
const charge = (
  id: string,
  finalAmount: string,
  dueDate: string,
  paid = '0.00',
  createdAt = '2026-01-01T00:00:00.000Z',
) => ({
  id,
  studentDueAmount: decimal(finalAmount),
  dueDate: new Date(`${dueDate}T00:00:00.000Z`),
  createdAt: new Date(createdAt),
  allocations: paid === '0.00' ? [] : [{ amount: decimal(paid) }],
});
const allocations = (amount: string, charges: ReturnType<typeof charge>[]) =>
  buildPaymentAllocationPlan(charges, decimal(amount)).allocations.map((item) => ({
    id: item.monthlyChargeId,
    amount: item.amount.toFixed(2),
  }));

describe('oldest-first payment allocation', () => {
  it.each([
    ['10.00', [{ id: 'june', amount: '10.00' }]],
    ['30.00', [{ id: 'june', amount: '30.00' }]],
    [
      '50.00',
      [
        { id: 'june', amount: '30.00' },
        { id: 'july', amount: '20.00' },
      ],
    ],
    [
      '60.00',
      [
        { id: 'june', amount: '30.00' },
        { id: 'july', amount: '30.00' },
      ],
    ],
  ])('allocates a payment of %s without exceeding a charge', (amount, expected) => {
    expect(
      allocations(amount, [
        charge('july', '30.00', '2026-07-10'),
        charge('june', '30.00', '2026-06-10'),
      ]),
    ).toEqual(expected);
  });

  it('completes an already partial charge before spilling into the next one', () => {
    expect(
      allocations('25.00', [
        charge('june', '30.00', '2026-06-10', '20.00'),
        charge('july', '30.00', '2026-07-10'),
      ]),
    ).toEqual([
      { id: 'june', amount: '10.00' },
      { id: 'july', amount: '15.00' },
    ]);
  });

  it('breaks equal dates by createdAt and then id', () => {
    const sameDay = '2026-06-10';
    expect(
      allocations('25.00', [
        charge('b', '10.00', sameDay, '0.00', '2026-01-01T00:00:00.000Z'),
        charge('c', '10.00', sameDay, '0.00', '2025-12-01T00:00:00.000Z'),
        charge('a', '10.00', sameDay, '0.00', '2026-01-01T00:00:00.000Z'),
      ]),
    ).toEqual([
      { id: 'c', amount: '10.00' },
      { id: 'a', amount: '10.00' },
      { id: 'b', amount: '5.00' },
    ]);
  });

  it('returns exact totals and a remainder when an attempted payment exceeds debt', () => {
    const plan = buildPaymentAllocationPlan(
      [charge('only', '50.00', '2026-06-10')],
      decimal('60.00'),
    );
    expect(plan.totalOutstanding.toFixed(2)).toBe('50.00');
    expect(
      plan.allocations.reduce((sum, item) => sum.plus(item.amount), decimal('0')).toFixed(2),
    ).toBe('50.00');
    expect(plan.remaining.toFixed(2)).toBe('10.00');
  });

  it('derives PENDING, PARTIAL and PAID from confirmed allocation totals', () => {
    expect(paymentChargeStatus(decimal('0'), decimal('30'))).toBe('PENDING');
    expect(paymentChargeStatus(decimal('10'), decimal('30'))).toBe('PARTIAL');
    expect(paymentChargeStatus(decimal('30'), decimal('30'))).toBe('PAID');
  });
});
