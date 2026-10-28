import type { AttendanceDto, AttendanceQuickSearchDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import { attendanceSlotKey, rosterPath, withSavedAttendance } from './attendance-sessions';

const attendance = (scheduleId: string | null): AttendanceDto => ({
  id: `asistencia-${scheduleId ?? 'fuera'}`,
  enrollmentId: 'salsa',
  attendanceDate: '2026-10-26',
  scheduleId,
  status: 'PRESENT',
  notes: null,
  createdAt: '2026-10-26T22:00:00.000Z',
  updatedAt: '2026-10-26T22:00:00.000Z',
});
const session = (scheduleId: string, startTime: string) => ({
  scheduleId,
  startTime,
  endTime: `${Number(startTime.slice(0, 2)) + 1}:00`,
  roomName: 'Salón principal',
  attendance: null,
});
const results: AttendanceQuickSearchDto['items'] = [
  {
    student: { id: 'ana', dni: '40111222', firstName: 'Ana', lastName: 'Paz' },
    enrollments: [
      {
        enrollmentId: 'salsa',
        classId: 'clase-salsa',
        className: 'Salsa',
        teacher: { id: 'prof', firstName: 'Luz', lastName: 'Gómez' },
        schedules: [],
        scheduledOnSelectedDay: true,
        daySessions: [session('h19', '19:00'), session('h21', '21:00')],
        attendance: null,
      },
      {
        enrollmentId: 'bachata',
        classId: 'clase-bachata',
        className: 'Bachata',
        teacher: { id: 'prof', firstName: 'Luz', lastName: 'Gómez' },
        schedules: [],
        scheduledOnSelectedDay: true,
        daySessions: [session('b20', '20:00')],
        attendance: null,
      },
    ],
  },
];

describe('asistencia por horario', () => {
  it('cada horario del día tiene su propio botón', () => {
    expect(attendanceSlotKey('salsa', 'h19')).not.toBe(attendanceSlotKey('salsa', 'h21'));
    expect(attendanceSlotKey('salsa', null)).toBe('salsa:fuera-de-horario');
  });

  it('pide la planilla del horario elegido', () => {
    expect(rosterPath('clase-salsa', 'h21', '2026-10-26')).toBe(
      '/attendances/roster?classId=clase-salsa&scheduleId=h21&date=2026-10-26',
    );
  });

  it('el presente del primer horario no marca el segundo', () => {
    const [student] = withSavedAttendance(results, attendance('h19'));
    const [salsa, bachata] = student!.enrollments;
    expect(salsa!.daySessions.map((item) => item.attendance?.id ?? null)).toEqual([
      'asistencia-h19',
      null,
    ]);
    expect(salsa!.attendance).toBeNull();
    expect(bachata!.daySessions[0]!.attendance).toBeNull();
  });

  it('una asistencia fuera de horario queda en la inscripción', () => {
    const [student] = withSavedAttendance(results, attendance(null));
    expect(student!.enrollments[0]!.attendance?.id).toBe('asistencia-fuera');
    expect(student!.enrollments[0]!.daySessions.every((item) => !item.attendance)).toBe(true);
  });
});
