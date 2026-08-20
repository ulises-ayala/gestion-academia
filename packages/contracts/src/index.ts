/** Decimal monetary values cross the API boundary as strings to preserve precision. */
export type MoneyDto = Readonly<{ amount: string; currency: string }>;

export type ApiErrorDto = Readonly<{
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  traceId?: string;
}>;

export type StudentStatusDto = 'ACTIVE' | 'INACTIVE';

export type StudentDto = Readonly<{
  id: string;
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  joinedAt: string;
  status: StudentStatusDto;
  createdAt: string;
  updatedAt: string;
}>;

export type StudentListDto = Readonly<{
  items: readonly StudentDto[];
  total: number;
  page: number;
  pageSize: number;
}>;

export type CreateStudentDto = Readonly<{
  dni: string;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}>;

export type UpdateStudentDto = Readonly<Partial<CreateStudentDto> & { status?: StudentStatusDto }>;

export type AdminRoleDto = 'ADMINISTRATOR' | 'RECEPTION' | 'MANAGER';
export type AuthUserDto = Readonly<{
  id: string;
  username: string;
  role: AdminRoleDto;
  status: 'ACTIVE' | 'INACTIVE';
}>;
export type AuthSessionDto = Readonly<{ user: AuthUserDto; expiresAt: string }>;
export type SetupStatusDto = Readonly<{ required: boolean }>;
export type AuthCredentialsDto = Readonly<{ username: string; password: string }>;

export type RecordStatusDto = 'ACTIVE' | 'INACTIVE';
export type PageDto<T> = Readonly<{
  items: readonly T[];
  total: number;
  page: number;
  pageSize: number;
}>;

export type TeacherDto = Readonly<{
  id: string;
  dni: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: RecordStatusDto;
  createdAt: string;
  updatedAt: string;
}>;
export type TeacherListDto = PageDto<TeacherDto>;
export type CreateTeacherDto = Readonly<{
  dni: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}>;
export type UpdateTeacherDto = Readonly<Partial<CreateTeacherDto> & { status?: RecordStatusDto }>;

export type DanceTypeDto = Readonly<{
  id: string;
  name: string;
  description: string | null;
  status: RecordStatusDto;
  createdAt: string;
  updatedAt: string;
}>;
export type CreateDanceTypeDto = Readonly<{ name: string; description?: string | null }>;
export type UpdateDanceTypeDto = Readonly<
  Partial<CreateDanceTypeDto> & { status?: RecordStatusDto }
>;

export type BranchDto = Readonly<{
  id: string;
  name: string;
  address: string;
  status: RecordStatusDto;
  createdAt: string;
  updatedAt: string;
}>;
export type CreateBranchDto = Readonly<{ name: string; address: string }>;
export type UpdateBranchDto = Readonly<Partial<CreateBranchDto> & { status?: RecordStatusDto }>;

export type RoomDto = Readonly<{
  id: string;
  name: string;
  capacity: number;
  branchId: string;
  branch: Readonly<{ id: string; name: string }>;
  status: RecordStatusDto;
  createdAt: string;
  updatedAt: string;
}>;
export type CreateRoomDto = Readonly<{ name: string; capacity: number; branchId: string }>;
export type UpdateRoomDto = Readonly<Partial<CreateRoomDto> & { status?: RecordStatusDto }>;

export type DayOfWeekDto =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';
export type ClassScheduleInputDto = Readonly<{
  dayOfWeek: DayOfWeekDto;
  startTime: string;
  endTime: string;
  roomId: string;
}>;
export type ClassScheduleDto = Readonly<{
  id: string;
  dayOfWeek: DayOfWeekDto;
  startTime: string;
  endTime: string;
  room: Readonly<{ id: string; name: string; branch: Readonly<{ id: string; name: string }> }>;
}>;
export type ClassDto = Readonly<{
  id: string;
  name: string;
  level: string | null;
  capacity: number;
  status: RecordStatusDto;
  danceType: Readonly<{ id: string; name: string }>;
  teacher: Readonly<{ id: string; firstName: string; lastName: string }>;
  schedules: readonly ClassScheduleDto[];
  createdAt: string;
  updatedAt: string;
  activeEnrollmentCount?: number;
}>;
export type ClassListDto = PageDto<ClassDto>;
export type CreateClassDto = Readonly<{
  name: string;
  danceTypeId: string;
  teacherId: string;
  level?: string | null;
  capacity: number;
  schedules: readonly ClassScheduleInputDto[];
}>;
export type UpdateClassDto = Readonly<
  Partial<Omit<CreateClassDto, 'schedules'>> & {
    schedules?: readonly ClassScheduleInputDto[];
    status?: RecordStatusDto;
  }
>;

export type EnrollmentStatusDto = 'ACTIVE' | 'ENDED';
export type EnrollmentStudentDto = Readonly<
  Pick<StudentDto, 'id' | 'dni' | 'firstName' | 'lastName' | 'phone' | 'status'>
>;
export type EnrollmentDto = Readonly<{
  id: string;
  studentId: string;
  classId: string;
  startDate: string;
  endDate: string | null;
  status: EnrollmentStatusDto;
  student: EnrollmentStudentDto;
  academicClass: ClassDto;
  createdAt: string;
  updatedAt: string;
}>;
export type CreateEnrollmentDto = Readonly<{
  studentId: string;
  classId: string;
  startDate: string;
}>;
export type EndEnrollmentDto = Readonly<{ endDate: string }>;
export type EnrollmentListDto = PageDto<EnrollmentDto>;
export type EnrollmentAvailabilityDto = Readonly<{
  classId: string;
  activeCount: number;
  capacity: number;
  available: number;
  full: boolean;
}>;

export type TariffDto = Readonly<{
  id: string;
  name: string;
  amount: string;
  validFrom: string;
  validTo: string | null;
  status: RecordStatusDto;
  createdAt: string;
  updatedAt: string;
}>;
export type CreateTariffDto = Readonly<{
  name: string;
  amount: string;
  validFrom: string;
  validTo?: string | null;
}>;
export type UpdateTariffDto = Readonly<Partial<CreateTariffDto> & { status?: RecordStatusDto }>;

export type MonthlyChargeStatusDto = 'PENDING' | 'PAID' | 'VOID';
export type MonthlyChargeDto = Readonly<{
  id: string;
  studentId: string;
  enrollmentId: string;
  tariffId: string;
  period: string;
  baseAmount: string;
  discountAmount: string;
  finalAmount: string;
  dueDate: string;
  status: MonthlyChargeStatusDto;
  academicClass: Readonly<{ id: string; name: string }>;
  tariff: Readonly<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
}>;
export type CreateMonthlyChargeDto = Readonly<{
  enrollmentId: string;
  tariffId: string;
  period: string;
  dueDate: string;
}>;
export type MonthlyChargeListDto = Readonly<{
  items: readonly MonthlyChargeDto[];
  total: number;
}>;
