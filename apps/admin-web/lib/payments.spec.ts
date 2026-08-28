import type { MonthlyChargeDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import { createPaymentPayload, selectedTotal } from './payments';

const charge = (id: string, amount: string) => ({ id, finalAmount: amount }) as MonthlyChargeDto;
describe('payments UI helpers', () => {
  it('calcula el total visual', () =>
    expect(
      selectedTotal([charge('a', '40000.00'), charge('b', '25000.00')], new Set(['a', 'b'])),
    ).toBe(65000));
  it('envía solamente ids y medio', () =>
    expect(createPaymentPayload(new Set(['a']), 'CASH')).toEqual({
      monthlyChargeIds: ['a'],
      paymentMethod: 'CASH',
    }));
});
