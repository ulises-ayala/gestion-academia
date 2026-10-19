import type { ClassDto, DayOfWeekDto } from '@academy/contracts';

export const WEEK_DAYS: readonly DayOfWeekDto[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export type AgendaFilters = Readonly<{
  branchId: string;
  roomId: string;
  teacherId: string;
  danceTypeId: string;
}>;

export const emptyAgendaFilters: AgendaFilters = {
  branchId: '',
  roomId: '',
  teacherId: '',
  danceTypeId: '',
};

export type AgendaEntry = Readonly<{
  key: string;
  classId: string;
  className: string;
  level: string | null;
  danceType: string;
  teacher: string;
  startTime: string;
  endTime: string;
  room: string;
  branch: string;
  enrolled: number;
  capacity: number;
  occupancy: 'full' | 'high' | 'open';
}>;

export type AgendaDay = Readonly<{ day: DayOfWeekDto; entries: readonly AgendaEntry[] }>;

/** Cupo usado: completo al llegar al cupo, alto desde el 80 %. */
export const occupancyLevel = (enrolled: number, capacity: number): AgendaEntry['occupancy'] => {
  if (capacity > 0 && enrolled >= capacity) return 'full';
  if (capacity > 0 && enrolled / capacity >= 0.8) return 'high';
  return 'open';
};

/**
 * Arma la semana a partir de las clases activas: una entrada por horario, ordenada por hora.
 * Lunes a sábado se muestran siempre; el domingo sólo si tiene clases.
 */
export const buildWeeklyAgenda = (
  classes: readonly ClassDto[],
  filters: AgendaFilters = emptyAgendaFilters,
): AgendaDay[] => {
  const entries = classes
    .filter((item) => item.status === 'ACTIVE')
    .filter((item) => !filters.teacherId || item.teacher.id === filters.teacherId)
    .filter((item) => !filters.danceTypeId || item.danceType.id === filters.danceTypeId)
    .flatMap((item) =>
      item.schedules
        .filter((schedule) => !filters.branchId || schedule.room.branch.id === filters.branchId)
        .filter((schedule) => !filters.roomId || schedule.room.id === filters.roomId)
        .map((schedule) => {
          const enrolled = item.activeEnrollmentCount ?? 0;
          return {
            day: schedule.dayOfWeek,
            entry: {
              key: `${item.id}-${schedule.id}`,
              classId: item.id,
              className: item.name,
              level: item.level,
              danceType: item.danceType.name,
              teacher: `${item.teacher.firstName} ${item.teacher.lastName}`,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              room: schedule.room.name,
              branch: schedule.room.branch.name,
              enrolled,
              capacity: item.capacity,
              occupancy: occupancyLevel(enrolled, item.capacity),
            } satisfies AgendaEntry,
          };
        }),
    );
  return WEEK_DAYS.map((day) => ({
    day,
    entries: entries
      .filter((item) => item.day === day)
      .map((item) => item.entry)
      .sort(
        (left, right) =>
          left.startTime.localeCompare(right.startTime) ||
          left.className.localeCompare(right.className, 'es'),
      ),
  })).filter((day) => day.day !== 'SUNDAY' || day.entries.length > 0);
};

/** Opciones únicas para los filtros, tomadas de las propias clases. */
export const agendaFilterOptions = (classes: readonly ClassDto[]) => {
  const unique = (pairs: readonly (readonly [string, string])[]) =>
    [...new Map(pairs).entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'es'));
  const schedules = classes.flatMap((item) => item.schedules);
  return {
    branches: unique(schedules.map((s) => [s.room.branch.id, s.room.branch.name] as const)),
    rooms: schedules.map((s) => ({ id: s.room.id, name: s.room.name, branchId: s.room.branch.id })),
    teachers: unique(
      classes.map((c) => [c.teacher.id, `${c.teacher.lastName}, ${c.teacher.firstName}`] as const),
    ),
    danceTypes: unique(classes.map((c) => [c.danceType.id, c.danceType.name] as const)),
  };
};

/** Día de la semana en la zona operativa, para resaltar "hoy". */
export const businessWeekDay = (now: Date, timeZone = 'America/Buenos_Aires'): DayOfWeekDto => {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' })
    .format(now)
    .toUpperCase();
  return name as DayOfWeekDto;
};
