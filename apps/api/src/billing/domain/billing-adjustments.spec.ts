import { Prisma } from '@academy/database';
import { describe, expect, it } from 'vitest';
import {
  adjustedAmounts,
  chargeStatus,
  conditionDeltas,
  LATE_FEE_AMOUNT,
} from './billing-adjustments';

const amount = (value: string | number) => new Prisma.Decimal(value);

describe('billing adjustments', () => {
  it('calculates multiple percentages independently over the tariff base', () => {
    const base = amount(10000);
    const first = conditionDeltas(base, {
      type: 'TEACHER_DISCOUNT',
      calculation: 'PERCENTAGE',
      configuredValue: amount(10),
    });
    const second = conditionDeltas(base, {
      type: 'TEACHER_DISCOUNT',
      calculation: 'PERCENTAGE',
      configuredValue: amount(20),
    });
    expect(adjustedAmounts(base, [first, second]).studentDue.toFixed(2)).toBe('7000.00');
  });

  it('keeps Direction scholarship in the teacher settlement base', () => {
    const result = conditionDeltas(amount(40000), {
      type: 'DIRECTION_SCHOLARSHIP',
      calculation: 'PERCENTAGE',
      configuredValue: amount(100),
    });
    expect(result.studentAmountDelta.toFixed(2)).toBe('-40000.00');
    expect(result.settlementBaseDelta.toFixed(2)).toBe('0.00');
  });

  it('removes teacher scholarships from both student debt and settlement base', () => {
    const base = amount(40000);
    const result = adjustedAmounts(base, [
      conditionDeltas(base, {
        type: 'TEACHER_SCHOLARSHIP',
        calculation: 'PERCENTAGE',
        configuredValue: amount(100),
      }),
    ]);
    expect(result.studentDue.toFixed(2)).toBe('0.00');
    expect(result.settlementBase.toFixed(2)).toBe('0.00');
    expect(chargeStatus(amount(0), result.studentDue)).toBe('PAID');
  });

  it('caps adjusted amounts at zero and exposes the fixed late fee', () => {
    expect(
      adjustedAmounts(amount(100), [
        { studentAmountDelta: amount(-200), settlementBaseDelta: amount(-200) },
      ]).studentDue.toFixed(2),
    ).toBe('0.00');
    expect(LATE_FEE_AMOUNT.toFixed(2)).toBe('1000.00');
  });
});
