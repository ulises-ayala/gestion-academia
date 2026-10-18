import type { OperationalDashboardDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import {
  businessClock,
  classAttendanceState,
  dashboardAlerts,
  followUpWhen,
  longBusinessDate,
  nowFocus,
  personInitials,
  type TodayClass,
} from './dashboard-today';

const lesson = (overrides: Partial<TodayClass>): TodayClass => ({
  id: 'class-1',
  name: 'Ballet inicial',
  startTime: '10:00',
  endTime: '11:00',
  teacher: 'Valentina Ruiz',
  room: 'Sala 2',
  branch: 'Centro',
  enrolledStudents: 18,
  attendanceRecords: 0,
  ...overrides,
});

const dashboard = (overrides: Partial<OperationalDashboardDto> = {}): OperationalDashboardDto => ({
  generatedAt: '2026-10-16T13:00:00.000Z',
  businessDate: '2026-10-16',
  ...overrides,
});

const allowAll = () => true;

describe('classAttendanceState', () => {
  it('distinguishes complete, partial, pending, empty and hidden attendance', () => {
    expect(classAttendanceState(lesson({ attendanceRecords: 18 }))).toBe('complete');
    expect(classAttendanceState(lesson({ attendanceRecords: 4 }))).toBe('partial');
    expect(classAttendanceState(lesson({ attendanceRecords: 0 }))).toBe('pending');
    expect(classAttendanceState(lesson({ enrolledStudents: 0 }))).toBe('no-students');
    expect(classAttendanceState(lesson({ attendanceRecords: null }))).toBe('unknown');
  });
});

describe('dashboardAlerts', () => {
  it('keeps each alert separate with its own reason and skips empty ones', () => {
    const alerts = dashboardAlerts(
      dashboard({
        followUp: { students: 3 },
        billing: {
          pendingCharges: 9,
          pendingDebt: '96500.00',
          overdueCharges: 5,
          overdueStudents: 4,
        },
        leads: {
          inquiry: 0,
          interested: 0,
          trial: 0,
          followUpsToday: 0,
          overdueFollowUps: 0,
          priority: [],
        },
      }),
      allowAll,
    );
    expect(alerts.map((alert) => alert.title)).toEqual([
      '3 alumnos con 3 o más ausencias',
      '5 cuotas vencidas',
    ]);
    expect(alerts[1]?.description).toBe('Corresponden a 4 alumnos.');
  });

  it('uses singular forms and respects permissions', () => {
    const data = dashboard({
      followUp: { students: 1 },
      leads: {
        inquiry: 0,
        interested: 0,
        trial: 0,
        followUpsToday: 0,
        overdueFollowUps: 1,
        priority: [],
      },
    });
    expect(dashboardAlerts(data, allowAll).map((alert) => alert.title)).toEqual([
      '1 alumno con 3 o más ausencias',
      '1 seguimiento comercial atrasado',
    ]);
    expect(
      dashboardAlerts(data, (permission) => permission !== 'students:manage').map((a) => a.key),
    ).toEqual(['overdue-leads']);
  });
});

describe('nowFocus', () => {
  const alerts = dashboardAlerts(dashboard({ followUp: { students: 3 } }), allowAll);
  const agenda = [
    lesson({
      id: 'early',
      startTime: '08:00',
      endTime: '09:00',
      attendanceRecords: 12,
      enrolledStudents: 12,
    }),
    lesson({ id: 'ballet', startTime: '10:00', endTime: '11:00' }),
    lesson({ id: 'contemporary', startTime: '17:00', endTime: '18:00' }),
  ];

  it('prioritises a class that starts soon and still needs attendance', () => {
    expect(nowFocus(agenda, alerts, '09:20')).toMatchObject({
      kind: 'class',
      item: { id: 'ballet' },
      phase: 'upcoming',
    });
    expect(nowFocus(agenda, alerts, '10:15')).toMatchObject({ phase: 'in-progress' });
  });

  it('then points to a finished class whose attendance was not taken', () => {
    expect(nowFocus(agenda, alerts, '12:00')).toMatchObject({
      item: { id: 'ballet' },
      phase: 'missed',
    });
  });

  it('falls back to alerts, then to the next class, then to an all-clear state', () => {
    const done = agenda.map((item) => ({ ...item, attendanceRecords: item.enrolledStudents }));
    expect(nowFocus(done, alerts, '12:00')).toMatchObject({
      kind: 'alert',
      alert: { key: 'student-follow-up' },
    });
    const later = [
      lesson({ id: 'late', startTime: '19:00', endTime: '20:00', attendanceRecords: null }),
    ];
    expect(nowFocus(later, [], '12:00')).toMatchObject({ phase: 'later', item: { id: 'late' } });
    expect(nowFocus([], [], '12:00')).toEqual({ kind: 'clear' });
  });
});

describe('formatting helpers', () => {
  it('formats the business date and clock in Buenos Aires', () => {
    expect(longBusinessDate('2026-10-16')).toBe('Viernes 16 de octubre');
    expect(businessClock(new Date('2026-10-16T13:05:00.000Z'))).toBe('10:05');
  });

  it('labels the next lead contact relative to the business day', () => {
    expect(followUpWhen('2026-10-16T18:00:00.000Z', false, '2026-10-16')).toBe('Hoy');
    expect(followUpWhen('2026-10-17T14:00:00.000Z', false, '2026-10-16')).toBe('Mañana');
    expect(followUpWhen('2026-10-21T14:00:00.000Z', false, '2026-10-16')).toBe('21/10');
    expect(followUpWhen('2026-10-15T14:00:00.000Z', true, '2026-10-16')).toBe('Vencido');
  });

  it('builds up to two initials', () => {
    expect(personInitials('Lucía Martínez')).toBe('LM');
    expect(personInitials('tomás')).toBe('T');
  });
});
