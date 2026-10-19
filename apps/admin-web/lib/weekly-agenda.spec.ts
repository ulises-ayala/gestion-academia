import type { ClassDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import {
  agendaFilterOptions,
  buildWeeklyAgenda,
  businessWeekDay,
  occupancyLevel,
} from './weekly-agenda';

const room = (id: string, name: string, branchId = 'b1', branchName = 'Centro') => ({
  id,
  name,
  branch: { id: branchId, name: branchName },
});

const lesson = (overrides: Partial<ClassDto> & Pick<ClassDto, 'id' | 'name'>): ClassDto => ({
  level: null,
  capacity: 20,
  status: 'ACTIVE',
  danceType: { id: 'd1', name: 'Zumba' },
  teacher: { id: 't1', firstName: 'Jose Luis', lastName: 'Barrios' },
  schedules: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  activeEnrollmentCount: 5,
  ...overrides,
});

const classes = [
  lesson({
    id: 'c1',
    name: 'Zumba',
    schedules: [
      {
        id: 's1',
        dayOfWeek: 'MONDAY',
        startTime: '18:00',
        endTime: '19:00',
        room: room('r1', 'Sala 1'),
      },
      {
        id: 's2',
        dayOfWeek: 'WEDNESDAY',
        startTime: '18:00',
        endTime: '19:00',
        room: room('r1', 'Sala 1'),
      },
    ],
  }),
  lesson({
    id: 'c2',
    name: 'Ballet inicial',
    capacity: 10,
    activeEnrollmentCount: 10,
    danceType: { id: 'd2', name: 'Ballet' },
    teacher: { id: 't2', firstName: 'Valentina', lastName: 'Ruiz' },
    schedules: [
      {
        id: 's3',
        dayOfWeek: 'MONDAY',
        startTime: '10:00',
        endTime: '11:00',
        room: room('r2', 'Sala 2', 'b2', 'Norte'),
      },
    ],
  }),
  lesson({
    id: 'c3',
    name: 'Clase vieja',
    status: 'INACTIVE',
    schedules: [
      {
        id: 's4',
        dayOfWeek: 'SUNDAY',
        startTime: '10:00',
        endTime: '11:00',
        room: room('r1', 'Sala 1'),
      },
    ],
  }),
];

describe('buildWeeklyAgenda', () => {
  it('lists one entry per schedule, sorted by time, Monday to Saturday', () => {
    const week = buildWeeklyAgenda(classes);
    expect(week.map((day) => day.day)).toEqual([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ]);
    expect(week[0]?.entries.map((entry) => entry.className)).toEqual(['Ballet inicial', 'Zumba']);
    expect(week[2]?.entries).toHaveLength(1);
  });

  it('ignores inactive classes and only shows Sunday when it has classes', () => {
    const week = buildWeeklyAgenda(classes);
    expect(week.some((day) => day.day === 'SUNDAY')).toBe(false);
    const withSunday = buildWeeklyAgenda([{ ...classes[2]!, status: 'ACTIVE' }]);
    expect(withSunday.at(-1)?.day).toBe('SUNDAY');
  });

  it('filters by branch, room, teacher and dance type', () => {
    const byBranch = buildWeeklyAgenda(classes, {
      branchId: 'b2',
      roomId: '',
      teacherId: '',
      danceTypeId: '',
    });
    expect(byBranch.flatMap((day) => day.entries).map((entry) => entry.classId)).toEqual(['c2']);
    const byTeacher = buildWeeklyAgenda(classes, {
      branchId: '',
      roomId: '',
      teacherId: 't1',
      danceTypeId: '',
    });
    expect(byTeacher.flatMap((day) => day.entries)).toHaveLength(2);
  });

  it('marks full and nearly full classes', () => {
    expect(occupancyLevel(10, 10)).toBe('full');
    expect(occupancyLevel(8, 10)).toBe('high');
    expect(occupancyLevel(3, 10)).toBe('open');
    expect(occupancyLevel(0, 0)).toBe('open');
    expect(buildWeeklyAgenda(classes)[0]?.entries[0]?.occupancy).toBe('full');
  });
});

describe('agenda helpers', () => {
  it('builds sorted, unique filter options', () => {
    const options = agendaFilterOptions(classes);
    expect(options.branches.map((item) => item.name)).toEqual(['Centro', 'Norte']);
    expect(options.teachers.map((item) => item.name)).toEqual([
      'Barrios, Jose Luis',
      'Ruiz, Valentina',
    ]);
  });

  it('computes the business weekday in Buenos Aires', () => {
    expect(businessWeekDay(new Date('2026-10-17T02:00:00Z'))).toBe('FRIDAY');
    expect(businessWeekDay(new Date('2026-10-17T15:00:00Z'))).toBe('SATURDAY');
  });
});
