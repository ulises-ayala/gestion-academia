import { describe, expect, it } from 'vitest';
import { validateEndReason } from './enrollment';

describe('Enrollment end reason', () => {
  it.each([undefined, null, '', 'invalid', 7])('requires a known reason (%s)', (reason) => {
    expect(() => validateEndReason(reason, null)).toThrow(
      expect.objectContaining({ code: 'ENROLLMENT_END_REASON_REQUIRED' }),
    );
  });
  it.each([
    'NO_LONGER_ATTENDING',
    'SCHEDULE_CHANGE',
    'DISCIPLINE_CHANGE',
    'PERSONAL_REASONS',
    'NON_PAYMENT',
  ])('accepts %s without note', (reason) => {
    expect(validateEndReason(reason, '  ')).toEqual({ endReason: reason, endNote: null });
  });
  it.each([null, undefined, '', '   '])('requires OTHER note (%s)', (note) => {
    expect(() => validateEndReason('OTHER', note)).toThrow(
      expect.objectContaining({ code: 'ENROLLMENT_END_NOTE_REQUIRED' }),
    );
  });
  it('trims OTHER note', () =>
    expect(validateEndReason('OTHER', '  Viaje  ')).toEqual({
      endReason: 'OTHER',
      endNote: 'Viaje',
    }));
  it.each([{}, 10, 'x'.repeat(501)])('rejects invalid note', (note) => {
    expect(() => validateEndReason('PERSONAL_REASONS', note)).toThrow(
      expect.objectContaining({ code: 'INVALID_ENROLLMENT_END_NOTE' }),
    );
  });
});
