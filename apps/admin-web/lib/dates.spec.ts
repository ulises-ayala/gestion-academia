import { describe, expect, it } from 'vitest';
import { calculateAge, formatDate } from './dates';

describe('student dates', () => {
  it('calcula la edad sin persistirla', () => {
    expect(calculateAge('2000-08-20', new Date('2026-08-20T12:00:00Z'))).toBe(26);
    expect(calculateAge('2000-08-21', new Date('2026-08-20T12:00:00Z'))).toBe(25);
  });

  it('representa fechas ausentes con un guión', () => {
    expect(calculateAge(null)).toBeNull();
    expect(formatDate(null)).toBe('—');
  });
});
