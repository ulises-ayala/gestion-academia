import { describe, expect, it } from 'vitest';
import {
  findEnrollmentScheduleConflict,
  type EnrollmentScheduleCandidate,
} from './enrollment-schedule-conflict';

const schedule = (dayOfWeek: string, startTime: string, endTime: string) => ({
  dayOfWeek,
  startTime,
  endTime,
});
const existing = (
  schedules: EnrollmentScheduleCandidate['schedules'],
): EnrollmentScheduleCandidate => ({
  classId: crypto.randomUUID(),
  className: 'Bachata Inicial',
  schedules,
});
const conflicts = (
  requested: EnrollmentScheduleCandidate['schedules'],
  current: EnrollmentScheduleCandidate['schedules'],
) => findEnrollmentScheduleConflict(requested, [existing(current)]) !== null;

describe('conflictos horarios de Enrollment', () => {
  it.each([
    ['superposición parcial', '18:00', '19:00', '18:30', '19:30'],
    ['horario contenido', '18:00', '20:00', '19:00', '20:00'],
    ['misma hora', '18:00', '19:00', '18:00', '19:00'],
  ])('rechaza %s en el mismo día', (_case, leftStart, leftEnd, rightStart, rightEnd) => {
    expect(
      conflicts(
        [schedule('TUESDAY', leftStart, leftEnd)],
        [schedule('TUESDAY', rightStart, rightEnd)],
      ),
    ).toBe(true);
  });

  it('permite horarios contiguos', () => {
    expect(
      conflicts([schedule('TUESDAY', '19:00', '20:00')], [schedule('TUESDAY', '18:00', '19:00')]),
    ).toBe(false);
  });

  it('permite la misma hora en días distintos', () => {
    expect(
      conflicts([schedule('WEDNESDAY', '18:00', '19:00')], [schedule('TUESDAY', '18:00', '19:00')]),
    ).toBe(false);
  });

  it('detecta conflicto al comparar múltiples horarios', () => {
    expect(
      conflicts(
        [schedule('TUESDAY', '18:00', '19:00'), schedule('THURSDAY', '18:00', '19:00')],
        [schedule('THURSDAY', '18:30', '19:30')],
      ),
    ).toBe(true);
  });

  it('permite múltiples horarios sin coincidencia de día', () => {
    expect(
      conflicts(
        [schedule('TUESDAY', '18:00', '19:00'), schedule('THURSDAY', '18:00', '19:00')],
        [schedule('FRIDAY', '18:30', '19:30')],
      ),
    ).toBe(false);
  });
});
