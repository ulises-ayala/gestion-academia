import { describe, expect, it } from 'vitest';
import {
  enrollmentPeriodsOverlap,
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

  it.each([
    ['períodos separados', '2026-01-01', '2026-06-30', '2026-07-01', null, false],
    ['períodos cruzados', '2026-01-01', '2026-06-30', '2026-06-15', null, true],
    ['período abierto', '2026-01-01', null, '2026-07-01', null, true],
    ['ENDED anterior', '2026-05-01', '2026-05-15', '2026-05-20', null, false],
    ['ENDED coexistente', '2026-05-01', '2026-05-25', '2026-05-20', null, true],
  ])('evalúa %s por vigencia', (_case, leftStart, leftEnd, rightStart, rightEnd, expected) => {
    expect(
      enrollmentPeriodsOverlap(
        { startDate: leftStart, endDate: leftEnd },
        { startDate: rightStart, endDate: rightEnd },
      ),
    ).toBe(expected);
  });
});
