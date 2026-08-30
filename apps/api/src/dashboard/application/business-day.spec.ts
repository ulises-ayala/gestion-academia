import { describe, expect, it } from 'vitest';
import { businessDayAt } from './business-day';

describe('businessDayAt', () => {
  it('uses the Buenos Aires calendar day and UTC boundaries', () => {
    const day = businessDayAt(new Date('2026-08-30T02:30:00.000Z'), 'America/Buenos_Aires');
    expect(day.date).toBe('2026-08-29');
    expect(day.dayOfWeek).toBe('SATURDAY');
    expect(day.start.toISOString()).toBe('2026-08-29T03:00:00.000Z');
    expect(day.end.toISOString()).toBe('2026-08-30T03:00:00.000Z');
    expect(day.dateValue.toISOString()).toBe('2026-08-29T00:00:00.000Z');
  });
});
