import type { AttendanceData } from '../domain/attendance';

export const ATTENDANCE_REPOSITORY = Symbol('ATTENDANCE_REPOSITORY');

export type AttendancePersistenceInput = Omit<
  AttendanceData,
  'id' | 'createdAt' | 'updatedAt'
>;

export type AttendanceUpdateInput = Partial<
  Pick<AttendanceData, 'status' | 'notes'>
>;

export type AttendanceListFilters = Readonly<{
  classId?: string;
  attendanceDate?: Date;
}>;

export interface AttendanceRepository {
  create(input: AttendancePersistenceInput): Promise<AttendanceData>;

  findById(id: string): Promise<AttendanceData | null>;

  findByEnrollmentAndDate(
    enrollmentId: string,
    attendanceDate: Date,
  ): Promise<AttendanceData | null>;

  update(
    id: string,
    input: AttendanceUpdateInput,
  ): Promise<AttendanceData>;

  list(
    filters: AttendanceListFilters,
  ): Promise<readonly AttendanceData[]>;
}

