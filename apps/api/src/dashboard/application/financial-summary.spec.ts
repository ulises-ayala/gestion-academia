import { Prisma } from '@academy/database';
import { describe, expect, it } from 'vitest';
import { buildFinancialSummary, confirmedPaymentMonthsAt } from './financial-summary';

const amount = (value: string) => new Prisma.Decimal(value);

describe('financial dashboard summary', () => {
  it('always builds six calendar buckets across the year boundary in Buenos Aires', () => {
    const range = confirmedPaymentMonthsAt(
      new Date('2027-01-15T02:00:00.000Z'),
      'America/Buenos_Aires',
    );
    expect(range.months).toEqual([
      { year: 2026, month: 8 },
      { year: 2026, month: 9 },
      { year: 2026, month: 10 },
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
    ]);
    expect(range.start.toISOString()).toBe('2026-08-01T03:00:00.000Z');
    expect(range.end.toISOString()).toBe('2027-02-01T03:00:00.000Z');
  });

  it('fills missing months, totals six months and calculates positive variation', () => {
    const months = confirmedPaymentMonthsAt(
      new Date('2026-08-20T15:00:00Z'),
      'America/Buenos_Aires',
    ).months;
    const summary = buildFinancialSummary(months, [
      { year: 2026, month: 7, amount: amount('200.00') },
      { year: 2026, month: 8, amount: amount('250.00') },
    ]);
    expect(summary.monthlyConfirmed).toHaveLength(6);
    expect(summary.monthlyConfirmed[0]?.amount).toBe('0.00');
    expect(summary.currentMonthConfirmed).toBe('250.00');
    expect(summary.previousMonthConfirmed).toBe('200.00');
    expect(summary.lastSixMonthsConfirmed).toBe('450.00');
    expect(summary.variationPercent).toBe('25.0');
  });

  it('calculates negative variation and avoids division by zero', () => {
    const months = confirmedPaymentMonthsAt(
      new Date('2026-08-20T15:00:00Z'),
      'America/Buenos_Aires',
    ).months;
    expect(
      buildFinancialSummary(months, [
        { year: 2026, month: 7, amount: amount('200') },
        { year: 2026, month: 8, amount: amount('100') },
      ]).variationPercent,
    ).toBe('-50.0');
    expect(buildFinancialSummary(months, []).variationPercent).toBeNull();
  });
});
