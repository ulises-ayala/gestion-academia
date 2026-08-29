import type { DayOfWeekDto } from '@academy/contracts';
import type { AttendanceData } from '../domain/attendance';

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
    attendance: AttendanceData | null;
  }>[];
}>;

export type AttendanceDayClass = Readonly<{
  classId: string;
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

  findByEnrollmentAndDate(
    enrollmentId: string,
    attendanceDate: Date,
  ): Promise<AttendanceData | null>;

  update(id: string, input: AttendanceUpdateInput, actorId?: string): Promise<AttendanceData>;

  list(filters: AttendanceListFilters): Promise<readonly AttendanceData[]>;

  roster(classId: string, attendanceDate: Date): Promise<readonly AttendanceRosterItem[]>;

  dayClasses(attendanceDate: Date): Promise<readonly AttendanceDayClass[]>;

  quickSearch(
    query: string,
    attendanceDate: Date,
    includeOtherDays: boolean,
  ): Promise<readonly AttendanceQuickSearchItem[]>;

  saveRoster(
    classId: string,
    attendanceDate: Date,
    items: readonly AttendanceRosterSaveItem[],
  ): Promise<readonly AttendanceData[]>;
}
