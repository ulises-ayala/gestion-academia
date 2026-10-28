import type { DayOfWeekDto } from '@academy/contracts';
import type { AttendanceData, ClassDaySchedule } from '../domain/attendance';

export const ATTENDANCE_REPOSITORY = Symbol('ATTENDANCE_REPOSITORY');

export type AttendancePersistenceInput = Omit<AttendanceData, 'id' | 'createdAt' | 'updatedAt'>;

export type AttendanceUpdateInput = Partial<Pick<AttendanceData, 'status' | 'notes'>>;

export type AttendanceListFilters = Readonly<{
  classId?: string;
  studentId?: string;
  attendanceDate?: Date;
  limit?: number;
}>;

export type AttendanceRosterItem = Readonly<{
  enrollmentId: string;
  student: Readonly<{ id: string; dni: string; firstName: string; lastName: string }>;
  attendance: AttendanceData | null;
}>;

export type AttendanceQuickSearchItem = Readonly<{
  student: Readonly<{ id: string; dni: string; firstName: string; lastName: string }>;
  enrollments: readonly Readonly<{
    enrollmentId: string;
    classId: string;
    className: string;
    teacher: Readonly<{ id: string; firstName: string; lastName: string }>;
    schedules: readonly Readonly<{
      id: string;
      dayOfWeek: DayOfWeekDto;
      startTime: string;
      endTime: string;
      roomName: string;
    }>[];
    scheduledOnSelectedDay: boolean;
    /** Horarios de la clase en el día elegido, cada uno con su asistencia. */
    daySessions: readonly Readonly<{
      scheduleId: string;
      startTime: string;
      endTime: string;
      roomName: string;
      attendance: AttendanceData | null;
    }>[];
    /** Asistencia fuera de horario (la clase no se dicta ese día). */
    attendance: AttendanceData | null;
  }>[];
}>;

export type AttendanceDayClass = Readonly<{
  classId: string;
  scheduleId: string;
  className: string;
  danceType: string;
  teacher: Readonly<{ id: string; firstName: string; lastName: string }>;
  room: Readonly<{ id: string; name: string }>;
  branch: Readonly<{ id: string; name: string }>;
  startTime: string;
  endTime: string;
  enrolledCount: number;
  presentCount: number;
}>;

export type AttendanceRosterSaveItem = Readonly<{
  enrollmentId: string;
  status: AttendanceData['status'];
  notes: string | null;
}>;

export interface AttendanceRepository {
  create(input: AttendancePersistenceInput): Promise<AttendanceData>;

  findById(id: string): Promise<AttendanceData | null>;

  findSlot(
    enrollmentId: string,
    attendanceDate: Date,
    scheduleId: string | null,
  ): Promise<AttendanceData | null>;

  /** Horarios activos de la clase en ese día de la semana, del más temprano al más tarde. */
  classDaySchedules(classId: string, dayOfWeek: DayOfWeekDto): Promise<readonly ClassDaySchedule[]>;

  update(id: string, input: AttendanceUpdateInput, actorId?: string): Promise<AttendanceData>;

  list(filters: AttendanceListFilters): Promise<readonly AttendanceData[]>;

  roster(
    classId: string,
    attendanceDate: Date,
    scheduleId: string | null,
  ): Promise<readonly AttendanceRosterItem[]>;

  dayClasses(attendanceDate: Date): Promise<readonly AttendanceDayClass[]>;

  quickSearch(
    query: string,
    attendanceDate: Date,
    includeOtherDays: boolean,
  ): Promise<readonly AttendanceQuickSearchItem[]>;

  saveRoster(
    classId: string,
    attendanceDate: Date,
    scheduleId: string | null,
    items: readonly AttendanceRosterSaveItem[],
  ): Promise<readonly AttendanceData[]>;
}
