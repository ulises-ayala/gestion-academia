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

export type LeadSourceDto = 'WHATSAPP' | 'INSTAGRAM' | 'IN_PERSON';
export type LeadStatusDto = 'INQUIRY' | 'INTERESTED' | 'TRIAL' | 'ENROLLED' | 'NOT_CONVERTED';
export type LeadDto = Readonly<{
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  source: LeadSourceDto;
  status: LeadStatusDto;
  notes: string | null;
  nextFollowUpAt: string | null;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;
export type LeadListDto = PageDto<LeadDto>;
export type CreateLeadDto = Readonly<{
  name: string;
  source: LeadSourceDto;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  status?: LeadStatusDto;
  notes?: string | null;
  nextFollowUpAt?: string | null;
  lastContactAt?: string | null;
}>;
export type UpdateLeadDto = Readonly<Partial<CreateLeadDto>>;
export type LeadDuplicateDto = Readonly<{
  lead: LeadDto;
  matches: readonly ('phone' | 'email' | 'instagram')[];
}>;
export type LeadDuplicateListDto = Readonly<{ items: readonly LeadDuplicateDto[] }>;

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
export type AdminUserDto = AuthUserDto;
export type CreateAdminUserDto = Readonly<{
  username: string;
  password: string;
  role: AdminRoleDto;
}>;
export type UpdateAdminUserDto = Readonly<{
  username?: string;
  password?: string;
  role?: AdminRoleDto;
  status?: RecordStatusDto;
}>;

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

export type MonthlyChargeStatusDto = 'PENDING' | 'PARTIAL' | 'PAID' | 'VOID';
export type MonthlyChargeDto = Readonly<{
  id: string;
  studentId: string;
  enrollmentId: string;
  tariffId: string;
  period: string;
  baseAmount: string;
  discountAmount: string;
  finalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  dueDate: string;
  overdue: boolean;
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

export type PaymentMethodDto = 'CASH' | 'MERCADO_PAGO' | 'CARD';
export type PaymentStatusDto = 'CONFIRMED' | 'VOID';
export type CreatePaymentDto = Readonly<{
  studentId: string;
  tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[];
}>;
export type PaymentTenderDto = Readonly<{
  id: string;
  method: PaymentMethodDto;
  amount: string;
}>;
export type PaymentAllocationDto = Readonly<{
  monthlyChargeId: string;
  amount: string;
  period: string;
  dueDate: string;
  academicClass: Readonly<{ id: string; name: string }>;
  finalAmount: string;
}>;
export type PaymentDto = Readonly<{
  id: string;
  student: Readonly<Pick<StudentDto, 'id' | 'dni' | 'firstName' | 'lastName'>>;
  amount: string;
  tenders: readonly PaymentTenderDto[];
  status: PaymentStatusDto;
  paidAt: string;
  createdBy: Readonly<{ id: string; username: string }>;
  voidedAt: string | null;
  voidedBy: Readonly<{ id: string; username: string }> | null;
  allocations: readonly PaymentAllocationDto[];
  createdAt: string;
  updatedAt: string;
}>;
export type PaymentListDto = PageDto<PaymentDto>;
export type ReceivablesScopeDto = 'pending' | 'overdue';
export type ReceivableDebtorDto = Readonly<{
  student: Readonly<Pick<StudentDto, 'id' | 'dni' | 'firstName' | 'lastName'>>;
  pendingCount: number;
  overdueCount: number;
  totalPending: string;
  oldestDueDate: string;
}>;
export type ReceivablesDto = Readonly<{
  scope: ReceivablesScopeDto;
  totalStudents: number;
  totalCharges: number;
  totalAmount: string;
  items: readonly ReceivableDebtorDto[];
  page: number;
  pageSize: number;
}>;
export type PaymentSummaryDto = Readonly<{ confirmedTotal: string }>;
export type VoidPaymentDto = Readonly<{ reason: string }>;

export type AuditActionDto =
  | 'UPDATE'
  | 'STATUS_CHANGE'
  | 'VOID'
  | 'END'
  | 'CORRECTION'
  | 'ROLE_CHANGE';
export type AuditEntityTypeDto =
  | 'STUDENT'
  | 'LEAD'
  | 'TEACHER'
  | 'DANCE_TYPE'
  | 'BRANCH'
  | 'ROOM'
  | 'ACADEMY_CLASS'
  | 'TARIFF'
  | 'ADMIN_USER'
  | 'PAYMENT'
  | 'ATTENDANCE'
  | 'ENROLLMENT';
export type AuditSnapshotDto = Readonly<Record<string, unknown>>;
export type AuditLogDto = Readonly<{
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  before: AuditSnapshotDto | null;
  after: AuditSnapshotDto | null;
  metadata: AuditSnapshotDto | null;
  createdAt: string;
  actor: Readonly<{ id: string; username: string }>;
}>;
export type AuditLogListDto = PageDto<AuditLogDto>;

export type CreateStudentOnboardingDto = Readonly<{
  student: CreateStudentDto;
  enrollments: readonly Readonly<{ classId: string; tariffId: string }>[];
  period?: string;
  dueDate?: string;
  payment?: Readonly<{ paymentMethod: PaymentMethodDto }> | null;
}>;
export type StudentOnboardingResultDto = Readonly<{
  student: StudentDto;
  enrollments: readonly EnrollmentDto[];
  charges: readonly MonthlyChargeDto[];
  payment: PaymentDto | null;
}>;

export type AttendanceStatusDto = 'PRESENT' | 'ABSENT' | 'JUSTIFIED';

export type AttendanceDto = Readonly<{
  id: string;
  enrollmentId: string;
  attendanceDate: string;
  status: AttendanceStatusDto;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type CreateAttendanceDto = Readonly<{
  enrollmentId: string;
  attendanceDate: string;
  status: AttendanceStatusDto;
  notes?: string | null;
}>;

export type UpdateAttendanceDto = Readonly<{
  status?: AttendanceStatusDto;
  notes?: string | null;
}>;

export type AttendanceListDto = Readonly<{
  items: readonly AttendanceDto[];
  total: number;
}>;

export type AttendanceRosterItemDto = Readonly<{
  enrollmentId: string;
  student: Readonly<Pick<StudentDto, 'id' | 'dni' | 'firstName' | 'lastName'>>;
  attendance: AttendanceDto | null;
}>;

export type AttendanceRosterDto = Readonly<{
  classId: string;
  date: string;
  items: readonly AttendanceRosterItemDto[];
}>;

export type AttendanceDayClassDto = Readonly<{
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

export type AttendanceDayDto = Readonly<{
  date: string;
  items: readonly AttendanceDayClassDto[];
}>;

export type SaveAttendanceRosterDto = Readonly<{
  classId: string;
  date: string;
  attendances: readonly Readonly<{
    enrollmentId: string;
    status: AttendanceStatusDto;
    notes?: string | null;
  }>[];
}>;

export type SaveAttendanceRosterResultDto = Readonly<{
  classId: string;
  date: string;
  items: readonly AttendanceDto[];
}>;

export type AttendanceQuickSearchEnrollmentDto = Readonly<{
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
  attendance: AttendanceDto | null;
}>;

export type AttendanceQuickSearchItemDto = Readonly<{
  student: Readonly<Pick<StudentDto, 'id' | 'dni' | 'firstName' | 'lastName'>>;
  enrollments: readonly AttendanceQuickSearchEnrollmentDto[];
}>;

export type AttendanceQuickSearchDto = Readonly<{
  query: string;
  date: string;
  items: readonly AttendanceQuickSearchItemDto[];
}>;

export type OperationalDashboardDto = Readonly<{
  generatedAt: string;
  businessDate: string;
  students?: Readonly<{ active: number }>;
  classes?: Readonly<{
    active: number;
    scheduledToday: number;
    today: readonly Readonly<{
      id: string;
      name: string;
      startTime: string;
      endTime: string;
      teacher: string;
      room: string;
      branch: string;
    }>[];
  }>;
  billing?: Readonly<{
    pendingCharges: number;
    pendingDebt: string;
    overdueCharges: number;
  }>;
  payments?: Readonly<{ confirmedToday: number; confirmedAmountToday: string }>;
  financial?: Readonly<{
    currentMonthConfirmed: string;
    previousMonthConfirmed: string;
    variationPercent: string | null;
    lastSixMonthsConfirmed: string;
    monthlyConfirmed: readonly Readonly<{
      year: number;
      month: number;
      label: string;
      fullLabel: string;
      amount: string;
    }>[];
  }>;
  attendance?: Readonly<{
    present: number;
    absent: number;
    justified: number;
    classesWithRecords: number;
  }>;
  leads?: Readonly<{
    inquiry: number;
    interested: number;
    trial: number;
    followUpsToday: number;
    overdueFollowUps: number;
    priority: readonly Readonly<{
      id: string;
      name: string;
      status: LeadStatusDto;
      nextFollowUpAt: string;
      overdue: boolean;
    }>[];
  }>;
  audit?: Readonly<{
    items: readonly Readonly<{
      id: string;
      action: string;
      entityType: string;
      entityId: string | null;
      createdAt: string;
      actorUsername: string;
    }>[];
  }>;
}>;
