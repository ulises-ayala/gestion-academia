import { DomainError } from '../../shared/domain/domain-error';

export const attendanceStatuses = ['PRESENT', 'ABSENT', 'JUSTIFIED'] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];

export const parseAttendanceDate = (value: string, field = 'attendanceDate') => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new DomainError('VALIDATION_ERROR', 'La fecha debe tener formato AAAA-MM-DD', { field });
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new DomainError('VALIDATION_ERROR', 'La fecha indicada no es válida', { field });
  return date;
};

export const parseAttendanceStatus = (value: unknown): AttendanceStatus => {
  if (typeof value !== 'string' || !attendanceStatuses.includes(value as AttendanceStatus))
    throw new DomainError('VALIDATION_ERROR', 'Estado de asistencia inválido', { field: 'status' });
  return value as AttendanceStatus;
};

export const normalizeAttendanceNotes = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string')
    throw new DomainError('VALIDATION_ERROR', 'La observación debe ser texto', { field: 'notes' });
  const notes = value.trim();
  if (notes.length > 1000)
    throw new DomainError('VALIDATION_ERROR', 'La observación admite hasta 1000 caracteres', {
      field: 'notes',
    });
  return notes || null;
};

const weekdays = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

/** Día de la semana de una fecha de asistencia (guardada a medianoche UTC). */
export const attendanceDayOfWeek = (attendanceDate: Date) => weekdays[attendanceDate.getUTCDay()]!;

export type ClassDaySchedule = Readonly<{ id: string; startTime: string; endTime: string }>;

/**
 * Decide a qué horario corresponde una asistencia. Cada horario del día tiene su propia
 * asistencia, así un alumno que cursa dos turnos de la misma clase queda presente en los dos.
 * Sin horario indicado: si la clase se dicta una sola vez ese día va a ese horario; si no se
 * dicta, queda como asistencia fuera de horario (null); si se dicta varias veces, hay que
 * elegir.
 */
export const resolveAttendanceSchedule = (
  daySchedules: readonly ClassDaySchedule[],
  requested: string | null | undefined,
): string | null => {
  if (requested) {
    if (!daySchedules.some((schedule) => schedule.id === requested))
      throw new DomainError(
        'VALIDATION_ERROR',
        'El horario no corresponde a esta clase en ese día',
        { field: 'scheduleId' },
      );
    return requested;
  }
  if (daySchedules.length === 0) return null;
  if (daySchedules.length === 1) return daySchedules[0]!.id;
  throw new DomainError(
    'VALIDATION_ERROR',
    'La clase tiene varios horarios ese día: indicá a cuál corresponde la asistencia',
    { field: 'scheduleId' },
  );
};

export const attendanceAlreadyExists = (scheduleId: string | null) =>
  new DomainError(
    'ATTENDANCE_ALREADY_EXISTS',
    scheduleId
      ? 'Ya existe una asistencia para esta inscripción en ese horario y fecha'
      : 'Ya existe una asistencia fuera de horario para esta inscripción y fecha',
  );

export type AttendanceData = Readonly<{
  id: string;
  enrollmentId: string;
  attendanceDate: Date;
  scheduleId: string | null;
  status: AttendanceStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;
