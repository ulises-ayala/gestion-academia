export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'JUSTIFIED';

export type AttendanceData = Readonly<{
  id: string;
  enrollmentId: string;
  attendanceDate: Date;
  status: AttendanceStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;