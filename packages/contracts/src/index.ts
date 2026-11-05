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

/** Clase de prueba gratis de un potencial alumno: una sola vez por clase, sin deuda. */
export type LeadTrialClassDto = Readonly<{
  id: string;
  academicClass: Readonly<{ id: string; name: string }>;
  /** Día de la prueba (AAAA-MM-DD). */
  trialDate: string;
  notes: string | null;
  createdBy: Readonly<{ id: string; username: string }>;
  createdAt: string;
}>;

export type CreateLeadTrialClassDto = Readonly<{
  classId: string;
  /** AAAA-MM-DD; si falta, hoy. No puede ser futura. */
  trialDate?: string | null;
  notes?: string | null;
}>;

/** Quitar una clase de prueba cargada por error (queda en la auditoría). */
export type RemoveLeadTrialClassDto = Readonly<{ reason: string }>;

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
  currentPassword?: string;
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

export type ReportMoneyByMethodDto = Readonly<{
  method: PaymentMethodDto;
  amount: string;
}>;
/**
 * Concepto de la recaudación: `CHARGES` (cuotas), `SINGLE_CLASS`, `CARD_SURCHARGE` o el id de un
 * concepto del catálogo.
 */
export type ReportCollectionConceptDto = string;
/** Lo cobrado de un concepto, separado por medio de pago. */
export type ReportConceptByMethodDto = Readonly<{
  concept: ReportCollectionConceptDto;
  /** Nombre para mostrar (Cuotas, Clase suelta, el del catálogo, Recargo por tarjeta). */
  label: string;
  byMethod: readonly ReportMoneyByMethodDto[];
  total: string;
}>;
/** Cierre de la recaudación: semanal (rango libre) o mensual (mes calendario). */
export type ClosingKindDto = 'WEEKLY' | 'MONTHLY';
/** Lo que guarda un cierre (la "foto") y lo que hay hoy para el mismo período. */
export type ClosingFiguresDto = Readonly<{
  collections: Readonly<{
    total: string;
    byMethod: readonly ReportMoneyByMethodDto[];
    byConceptAndMethod: readonly ReportConceptByMethodDto[];
  }>;
  refunds: Readonly<{ total: string; byMethod: readonly ReportMoneyByMethodDto[] }>;
  /** Solo en el cierre mensual: alumnos y deuda al momento del cierre. */
  students: Readonly<{
    active: number;
    newStudents: number;
    /** Alumnos con una inscripción finalizada en el mes y ninguna activa al cerrar. */
    dropped: number;
    pendingCharges: number;
    pendingDebt: string;
    overdueCharges: number;
    overdueDebt: string;
  }> | null;
}>;
export type CollectionClosingSummaryDto = Readonly<{
  id: string;
  kind: ClosingKindDto;
  fromDate: string;
  toDate: string;
  total: string;
  createdBy: Readonly<{ id: string; username: string }>;
  createdAt: string;
}>;
/** Una diferencia entre la foto y hoy: una corrección posterior al cierre. */
export type ClosingChangeDto = Readonly<{
  /** Concepto (`CHARGES`, `SINGLE_CLASS`, id del catálogo…) o `REFUNDS` para devoluciones. */
  concept: string;
  label: string;
  method: PaymentMethodDto;
  original: string;
  current: string;
  difference: string;
}>;
export type CollectionClosingDto = CollectionClosingSummaryDto &
  Readonly<{
    snapshot: ClosingFiguresDto;
    /** Importes de hoy para el mismo período (sin alumnos: esos quedan como estaban). */
    current: ClosingFiguresDto;
    changes: readonly ClosingChangeDto[];
  }>;
export type CollectionClosingListDto = PageDto<CollectionClosingSummaryDto>;
export type CreateClosingDto = Readonly<{
  kind: ClosingKindDto;
  /** Semanal: AAAA-MM-DD. */
  fromDate?: string | null;
  toDate?: string | null;
  /** Mensual: AAAA-MM. */
  month?: string | null;
}>;
/** Período que se propone para el próximo cierre, con sus importes de hoy. */
export type ClosingPreviewDto = Readonly<{
  kind: ClosingKindDto;
  fromDate: string;
  toDate: string;
  /** false si el período todavía no se puede cerrar (por ejemplo, el mes no terminó). */
  closable: boolean;
  reason: string | null;
  figures: ClosingFiguresDto;
}>;
export type ReportsSummaryDto = Readonly<{
  activeStudents: number;
  inactiveStudents: number;
  newStudents: number;
  pendingDebt: string;
  overdueCharges: number;
  overdueDebt: string;
  collectedAmount: string;
  confirmedPayments: number;
  closedCashShifts: number;
  cashDifference: string;
}>;
export type ReportStudentDto = Readonly<{
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  status: RecordStatusDto;
  joinedAt: string;
  activeEnrollments: number;
  currentDebt: string;
}>;
export type ReportDebtorDto = Readonly<{
  studentId: string;
  firstName: string;
  lastName: string;
  dni: string;
  openCharges: number;
  overdueCharges: number;
  totalDebt: string;
  overdueDebt: string;
  oldestDueDate: string;
}>;
export type ReportAttendanceClassDto = Readonly<{
  classId: string;
  className: string;
  teacherName: string;
  records: number;
  present: number;
  absent: number;
  justified: number;
}>;
export type ReportCashMethodDto = Readonly<{
  method: PaymentMethodDto;
  expected: string;
  declared: string;
  difference: string;
  correctedDeclared: string;
  correctedDifference: string;
}>;
export type ReportCashOperatorDto = Readonly<{
  userId: string;
  username: string;
  shifts: number;
  expected: string;
  declared: string;
  difference: string;
  correctedDifference: string;
}>;
export type ReportCashDifferenceDto = Readonly<{
  shiftId: string;
  closedAt: string;
  username: string;
  difference: string;
  correctedDifference: string;
}>;
/**
 * Lo cobrado en el período atribuido a cada profesor: cuotas y deuda anterior de sus clases
 * (profesor actual de la clase) y clases sueltas (profesor que la dictó, guardado en el cobro).
 */
export type ReportTeacherIncomeDto = Readonly<{
  teacherId: string;
  teacherName: string;
  charges: string;
  historicalDebt: string;
  singleClass: string;
  singleClassCount: number;
  total: string;
}>;
/** Clases sueltas cobradas en el período, por clase y profesor que la dictó. */
export type ReportSingleClassDto = Readonly<{
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  count: number;
  amount: string;
}>;
export type OperationalReportsDto = Readonly<{
  generatedAt: string;
  businessDate: string;
  from: string;
  to: string;
  summary: ReportsSummaryDto;
  students: PageDto<ReportStudentDto>;
  collections: Readonly<{
    total: string;
    count: number;
    byMethod: readonly ReportMoneyByMethodDto[];
    byDay: readonly Readonly<{ date: string; amount: string }>[];
    /** Lo cobrado separado por concepto: cuotas, clases sueltas y otros cobros. */
    byConcept: Readonly<{ charges: string; singleClass: string; other: string }>;
    /** Recaudación por concepto y medio (solo los conceptos con cobros en el período). */
    byConceptAndMethod: readonly ReportConceptByMethodDto[];
    /**
     * Devoluciones de saldo a favor del período (egresos de caja, por el día en que se
     * registraron). La recaudación de arriba es lo cobrado; lo que quedó en la academia es la
     * recaudación menos esto.
     */
    refunds: Readonly<{ total: string; byMethod: readonly ReportMoneyByMethodDto[] }>;
    singleClasses: readonly ReportSingleClassDto[];
    byTeacher: readonly ReportTeacherIncomeDto[];
  }>;
  debtors: PageDto<ReportDebtorDto>;
  attendance: Readonly<{
    records: number;
    present: number;
    absent: number;
    justified: number;
    byClass: readonly ReportAttendanceClassDto[];
  }>;
  cash: Readonly<{
    closedShifts: number;
    openShifts: number;
    byMethod: readonly ReportCashMethodDto[];
    byOperator: readonly ReportCashOperatorDto[];
    differences: readonly ReportCashDifferenceDto[];
  }>;
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
  /** Profesor responsable: recibe las cuotas en los reportes. */
  teacher: Readonly<{ id: string; firstName: string; lastName: string }>;
  /** Profesores que dictan la clase además del responsable. */
  additionalTeachers: readonly Readonly<{ id: string; firstName: string; lastName: string }>[];
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
  additionalTeacherIds?: readonly string[];
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
export type EnrollmentEndReasonDto =
  | 'NO_LONGER_ATTENDING'
  | 'SCHEDULE_CHANGE'
  | 'DISCIPLINE_CHANGE'
  | 'PERSONAL_REASONS'
  | 'NON_PAYMENT'
  | 'OTHER';
export type EnrollmentStudentDto = Readonly<
  Pick<StudentDto, 'id' | 'dni' | 'firstName' | 'lastName' | 'phone' | 'status'>
>;
export type EnrollmentDto = Readonly<{
  id: string;
  studentId: string;
  classId: string;
  startDate: string;
  endDate: string | null;
  endReason: EnrollmentEndReasonDto | null;
  endNote: string | null;
  status: EnrollmentStatusDto;
  /** Modalidad: tarifa que paga el alumno; null = la única tarifa vigente de la clase. */
  tariff: Readonly<{ id: string; name: string; amount: string }> | null;
  /** Día de pago acordado (1 a 31). */
  paymentDueDay: number;
  student: EnrollmentStudentDto;
  academicClass: ClassDto;
  createdAt: string;
  updatedAt: string;
}>;
export type CreateEnrollmentDto = Readonly<{
  studentId: string;
  classId: string;
  startDate: string;
  tariffId?: string | null;
  paymentDueDay?: number;
}>;
/** Condiciones de cobro de la inscripción; valen para las cuotas que se generen después. */
export type UpdateEnrollmentBillingTermsDto = Readonly<{
  tariffId?: string | null;
  paymentDueDay?: number;
}>;
export type EndEnrollmentDto = Readonly<{
  endDate: string;
  endReason: EnrollmentEndReasonDto;
  endNote?: string | null;
}>;
export type UpdateEnrollmentStartDateDto = Readonly<{ startDate: string }>;
/** Finaliza la inscripción actual el día anterior a `changeDate` e inscribe en `classId` desde esa fecha. */
export type ChangeEnrollmentClassDto = Readonly<{
  classId: string;
  changeDate: string;
  endReason: EnrollmentEndReasonDto;
  endNote?: string | null;
}>;
export type ChangeEnrollmentClassResultDto = Readonly<{
  ended: EnrollmentDto;
  created: EnrollmentDto;
}>;
export type StudentFollowUpItemDto = Readonly<{
  studentId: string;
  studentName: string;
  studentDni: string;
  enrollmentId: string;
  startDate: string;
  classId: string;
  className: string;
  teacherName: string;
  consecutiveAbsences: number;
  lastPresentAt: string | null;
  lastAttendanceRecordAt: string | null;
  lastAttendanceStatus: AttendanceStatusDto | null;
}>;
export type StudentFollowUpResponseDto = PageDto<StudentFollowUpItemDto> &
  Readonly<{
    students: number;
    globalTotal: number;
    classes: readonly Readonly<{ id: string; name: string }>[];
  }>;
export type EnrollmentListDto = PageDto<EnrollmentDto>;
export type EnrollmentAvailabilityDto = Readonly<{
  classId: string;
  activeCount: number;
  capacity: number;
  available: number;
  full: boolean;
}>;

export type TariffDto = Readonly<{
  classId: string;
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
  classId: string;
  name: string;
  amount: string;
  validFrom: string;
  validTo?: string | null;
}>;
export type UpdateTariffDto = Readonly<Partial<CreateTariffDto> & { status?: RecordStatusDto }>;

export type MonthlyChargeStatusDto = 'PENDING' | 'PARTIAL' | 'PAID' | 'VOID';
/** MONTHLY = cuota de un mes. HISTORICAL_DEBT = deuda anterior cargada como monto único. */
export type MonthlyChargeKindDto = 'MONTHLY' | 'HISTORICAL_DEBT';
export type BillingAdjustmentTypeDto =
  | 'DIRECTION_SCHOLARSHIP'
  | 'TEACHER_SCHOLARSHIP'
  | 'TEACHER_DISCOUNT'
  | 'LATE_FEE'
  | 'REVERSAL'
  | 'HISTORICAL_DISCOUNT';
export type BillingCalculationDto = 'PERCENTAGE' | 'FIXED';
export type MonthlyChargeAdjustmentDto = Readonly<{
  id: string | null;
  type: BillingAdjustmentTypeDto;
  calculation: BillingCalculationDto | null;
  configuredValue: string | null;
  effectiveAmount: string;
  studentAmountDelta: string;
  settlementBaseDelta: string;
  teacher: Readonly<{ id: string; firstName: string; lastName: string }> | null;
  reason: string | null;
  reversalOfId: string | null;
  persisted: boolean;
  createdAt: string | null;
}>;
export type MonthlyChargeDto = Readonly<{
  id: string;
  studentId: string;
  enrollmentId: string;
  kind: MonthlyChargeKindDto;
  /** Detalle de la deuda histórica; null en cuotas mensuales. */
  description: string | null;
  /** Null en deuda histórica. */
  tariffId: string | null;
  period: string;
  baseAmount: string;
  discountAmount: string;
  finalAmount: string;
  studentDueAmount: string;
  settlementBaseAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  dueDate: string;
  overdue: boolean;
  status: MonthlyChargeStatusDto;
  academicClass: Readonly<{ id: string; name: string }>;
  tariff: Readonly<{ id: string; name: string }> | null;
  adjustments: readonly MonthlyChargeAdjustmentDto[];
  createdAt: string;
  updatedAt: string;
}>;

export type EnrollmentBillingConditionDto = Readonly<{
  id: string;
  enrollmentId: string;
  type: Exclude<BillingAdjustmentTypeDto, 'LATE_FEE' | 'REVERSAL'>;
  calculation: BillingCalculationDto;
  configuredValue: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  teacher: Readonly<{ id: string; firstName: string; lastName: string }> | null;
  authorizedBy: Readonly<{ id: string; username: string }> | null;
  reason: string;
  endedAt: string | null;
  endReason: string | null;
  renewedFromId: string | null;
  createdAt: string;
}>;
export type CreateEnrollmentBillingConditionDto = Readonly<{
  type: Exclude<BillingAdjustmentTypeDto, 'LATE_FEE' | 'REVERSAL'>;
  calculation?: BillingCalculationDto;
  configuredValue?: string;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  teacherId?: string | null;
  reason: string;
}>;
export type EndEnrollmentBillingConditionDto = Readonly<{
  effectiveUntil: string;
  reason: string;
}>;
export type ReverseMonthlyChargeAdjustmentDto = Readonly<{ reason: string }>;
/** Nuevo vencimiento de una cuota mensual con saldo, dentro de su mes. */
export type ChangeMonthlyChargeDueDateDto = Readonly<{ dueDate: string; reason: string }>;
/** Pasar una cuota a otra clase del alumno (cambio de clase sin volver a cobrar). */
export type MoveMonthlyChargeDto = Readonly<{ enrollmentId: string; reason: string }>;
/** Actualizar una cuota sin pagos a la modalidad (tarifa) de la inscripción. */
export type UpdateMonthlyChargeTariffDto = Readonly<{ reason: string }>;
/** Importe actual de la cuota y el que tendría con la modalidad de la inscripción. */
export type MonthlyChargeTariffUpdateDto = Readonly<{
  chargeId: string;
  current: Readonly<{ tariffName: string | null; amount: string }>;
  next: Readonly<{ tariffId: string; tariffName: string; amount: string }>;
}>;
export type CreateMonthlyChargeDto = Readonly<{
  enrollmentId: string;
  tariffId: string;
  period: string;
  dueDate: string;
}>;
/**
 * Generación manual: la tarifa la resuelve el sistema. `period` es AAAA-MM; con `untilPeriod`
 * se generan todos los meses del rango (vencimiento el día 10 de cada uno).
 */
/** Deuda anterior al sistema: monto único con detalle, sin tarifa ni recargo. */
export type CreateHistoricalDebtDto = Readonly<{
  enrollmentId: string;
  amount: string;
  description: string;
}>;
export type GenerateMonthlyChargeDto = Readonly<{
  enrollmentId: string;
  period: string;
  untilPeriod?: string;
  dueDate?: string;
}>;
export type MonthlyChargePreviewMonthDto = Readonly<{
  period: string;
  dueDate: string;
  tariff: Readonly<{ id: string; name: string; amount: string }>;
  studentDueAmount: string;
  adjustments: readonly BillingAdjustmentTypeDto[];
  alreadyExists: boolean;
}>;
export type MonthlyChargePreviewDto = Readonly<{
  enrollmentId: string;
  className: string;
  months: readonly MonthlyChargePreviewMonthDto[];
  /** Cuotas que se van a crear (las que ya existen se saltean) y su importe. */
  newCount: number;
  newTotal: string;
  /** Si la deuda es anterior al inicio, la inscripción se adelanta a esa fecha. */
  enrollmentStartChange: Readonly<{ from: string; to: string }> | null;
}>;
export type GeneratedMonthlyChargesDto = Readonly<{
  created: readonly MonthlyChargeDto[];
  skippedPeriods: readonly string[];
}>;
export type MonthlyChargeListDto = Readonly<{
  items: readonly MonthlyChargeDto[];
  total: number;
}>;

export type PaymentMethodDto = 'CASH' | 'MERCADO_PAGO' | 'CARD' | 'TRANSFER';
export type PaymentStatusDto = 'CONFIRMED' | 'VOID';
export type CreatePaymentDto = Readonly<{
  studentId: string;
  tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[];
  /** Fecha real de un pago cargado tarde (AAAA-MM-DD). Solo Administración y Dirección. */
  paidDate?: string | null;
  /**
   * Cuotas que paga el alumno (de la más vieja a la más nueva entre ellas). Si falta, se imputa
   * desde la deuda más antigua. Solo Administración y Dirección.
   */
  monthlyChargeIds?: readonly string[] | null;
  /**
   * Tipo de tarjeta: el recargo (débito 4,04 %, crédito 7,80 % de lo que se paga con tarjeta) se
   * calcula en el servidor y se registra como otro cobro "Recargo por tarjeta". Exige tarjeta.
   */
  cardType?: CardTypeDto | null;
  /**
   * Dejar como saldo a favor lo que supere la deuda (o todo, si no debe nada). Sin esto, cobrar de
   * más se rechaza.
   */
  allowCredit?: boolean;
}>;
export type PaymentKindDto = 'CHARGES' | 'OTHER';
/** Tarjeta de débito o de crédito: define el recargo por pagar con tarjeta. */
export type CardTypeDto = 'DEBIT' | 'CREDIT';
/**
 * Tipo de otro cobro: clase suelta (clase y profesor), recargo por tarjeta, o un concepto del
 * catálogo (`OTHER` + `conceptId`: indumentaria, inscripciones, talleres, Gala, otros…).
 */
export type OtherPaymentConceptDto = 'SINGLE_CLASS' | 'OTHER' | 'CARD_SURCHARGE';
/** Concepto de ingreso del catálogo; lo amplían Administración y Dirección. */
export type PaymentConceptDto = Readonly<{
  id: string;
  name: string;
  /** Exige contar qué se cobró (por ejemplo, "Otros"). */
  requiresDetail: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  sortOrder: number;
}>;
export type SavePaymentConceptDto = Readonly<{
  name: string;
  requiresDetail?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
}>;
/** Cobro que no se imputa a cuotas: clase suelta (con su clase) u otro concepto (con detalle). */
/** Quien toma una clase suelta sin ser alumno regular: no tiene ficha ni cuotas. */
export type WalkInDto = Readonly<{ name: string; phone: string | null; dni: string | null }>;

export type CreateOtherPaymentDto = Readonly<{
  /** Alumno del cobro; falta solo en la clase suelta de un alumno eventual (\walkIn\). */
  studentId?: string | null;
  walkIn?: Readonly<{ name: string; phone?: string | null; dni?: string | null }> | null;
  concept: OtherPaymentConceptDto;
  /** Concepto del catálogo; obligatorio con `concept = OTHER`. */
  conceptId?: string | null;
  classId?: string | null;
  /** Profesor que dictó la clase suelta; si falta se usa el de la clase. */
  teacherId?: string | null;
  detail?: string | null;
  /** Puede estar vacío si todo se paga con saldo a favor (`creditAmount`). */
  tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[];
  /** Fecha real de un pago cargado tarde (AAAA-MM-DD). Solo Administración y Dirección. */
  paidDate?: string | null;
  /**
   * Parte que se paga con el saldo a favor del alumno (no pasa por la caja). Solo con alumno y no
   * en el recargo por tarjeta.
   */
  creditAmount?: string | null;
  /** Tipo de tarjeta para calcular el recargo (como en `CreatePaymentDto`); no en el recargo mismo. */
  cardType?: CardTypeDto | null;
}>;
export type PaymentTenderDto = Readonly<{
  id: string;
  method: PaymentMethodDto;
  amount: string;
}>;
export type PaymentAllocationDto = Readonly<{
  monthlyChargeId: string;
  amount: string;
  kind: MonthlyChargeKindDto;
  description: string | null;
  period: string;
  dueDate: string;
  academicClass: Readonly<{ id: string; name: string }>;
  finalAmount: string;
  studentDueAmount: string;
}>;
export type PaymentDto = Readonly<{
  id: string;
  /** phone: para mandar el recibo por WhatsApp desde el historial de cobros. */
  student: Readonly<
    Pick<StudentDto, 'id' | 'dni' | 'firstName' | 'lastName'> & { phone?: string | null }
  > | null;
  /** Alumno eventual de una clase suelta (sin ficha); null cuando el pago tiene alumno. */
  walkIn: WalkInDto | null;
  amount: string;
  /** Saldo a favor: lo cobrado que no quedó imputado a cuotas, no se devolvió ni se usó. */
  creditAmount: string;
  /** Lo devuelto del saldo a favor. */
  refundedAmount: string;
  /** En un otro cobro: la parte que se pagó con saldo a favor (no pasó por la caja). */
  paidWithCreditAmount: string;
  tenders: readonly PaymentTenderDto[];
  status: PaymentStatusDto;
  paidAt: string;
  createdBy: Readonly<{ id: string; username: string }>;
  /** Pago anulado que este corrige. */
  correctionOfId: string | null;
  /** Recargo por tarjeta vigente que se cobró junto con este cobro de cuotas. */
  cardSurcharge: Readonly<{ id: string; amount: string }> | null;
  /** En un recargo por tarjeta: el cobro de cuotas al que pertenece. */
  surchargeOfId: string | null;
  /** Pago que reemplazó a este al corregirlo (este queda anulado). */
  correctedById: string | null;
  voidedAt: string | null;
  voidedBy: Readonly<{ id: string; username: string }> | null;
  allocations: readonly PaymentAllocationDto[];
  kind: PaymentKindDto;
  /** Solo en cobros OTHER. */
  otherConcept: Readonly<{
    concept: OtherPaymentConceptDto;
    /** Concepto del catálogo (con `concept = OTHER`). */
    catalogConcept: Readonly<{ id: string; name: string }> | null;
    detail: string | null;
    academicClass: Readonly<{ id: string; name: string }> | null;
    teacher: Readonly<{ id: string; firstName: string; lastName: string }> | null;
  }> | null;
  createdAt: string;
  updatedAt: string;
}>;
export type PaymentListDto = PageDto<PaymentDto>;
export type ReceivablesScopeDto = 'pending' | 'overdue' | 'partial' | 'unpaid';
export type ReceivablesSortDto = 'oldest' | 'highest-debt' | 'name';
export type ReceivablesSummaryDto = Readonly<{
  totalStudents: number;
  totalCharges: number;
  overdueCharges: number;
  partialCharges: number;
  totalOriginal: string;
  totalPaid: string;
  totalOutstanding: string;
}>;
export type ReceivableDebtorDto = Readonly<{
  student: Readonly<Pick<StudentDto, 'id' | 'dni' | 'firstName' | 'lastName'>>;
  openChargeCount: number;
  overdueChargeCount: number;
  partialChargeCount: number;
  oldestDueDate: string;
  originalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
}>;
export type ReceivablesDto = Readonly<{
  scope: ReceivablesScopeDto;
  sort: ReceivablesSortDto;
  summary: ReceivablesSummaryDto;
  items: readonly ReceivableDebtorDto[];
  total: number;
  page: number;
  pageSize: number;
}>;
/** creditTotal: saldo a favor del alumno (suma de lo no imputado ni devuelto de sus pagos). */
export type PaymentSummaryDto = Readonly<{ confirmedTotal: string; creditTotal: string }>;
export type VoidPaymentDto = Readonly<{ reason: string }>;

/** Usar el saldo a favor del alumno en sus cuotas pendientes (motivo opcional). */
export type ApplyCreditDto = Readonly<{ studentId: string; reason?: string | null }>;
export type ApplyCreditResultDto = Readonly<{ applied: string }>;

/** Devolver saldo a favor de un pago: egreso de la caja del turno de quien devuelve. */
export type RefundPaymentDto = Readonly<{
  amount: string;
  method: PaymentMethodDto;
  reason: string;
  /**
   * Solo en efectivo: true si sale de la caja del turno abierto de quien la registra (egreso del
   * turno). Si no, queda registrada fuera de la caja (Dirección la hace desde su cuenta o con el
   * efectivo que guarda); Mercado Pago, transferencia y tarjeta siempre van fuera de la caja.
   */
  fromCashShift?: boolean | null;
}>;
/**
 * Corregir un pago: se anula y se reemplaza por uno nuevo con los medios, el importe o la fecha
 * correctos. Los movimientos de caja se corrigen en el turno del pago original.
 */
export type CorrectPaymentDto = Readonly<{
  reason: string;
  tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[];
  /** Fecha real del pago (AAAA-MM-DD); si falta se conserva la del original. */
  paidDate?: string | null;
}>;
/**
 * Reimputar un pago: cambia a qué cuotas se aplicó, sin tocar el pago ni la caja. `allocations`
 * es la imputación completa nueva y tiene que sumar el importe del pago.
 */
export type ReallocatePaymentDto = Readonly<{
  reason: string;
  allocations: readonly Readonly<{ monthlyChargeId: string; amount: string }>[];
}>;

/** Entrega del efectivo recaudado a Dirección (no es un gasto). Fechas AAAA-MM-DD. */
export type CashHandoverDto = Readonly<{
  id: string;
  fromDate: string;
  toDate: string;
  amount: string;
  /** Efectivo cobrado en el período al registrar la entrega. */
  collectedAmount: string;
  /** Entregado menos cobrado: negativo si se entregó menos de lo cobrado. */
  difference: string;
  receivedBy: string;
  note: string | null;
  createdBy: Readonly<{ id: string; username: string }>;
  createdAt: string;
  voidedAt: string | null;
  voidedBy: Readonly<{ id: string; username: string }> | null;
  voidReason: string | null;
}>;
export type CashHandoverListDto = PageDto<CashHandoverDto>;
export type CreateCashHandoverDto = Readonly<{
  fromDate: string;
  toDate: string;
  amount: string;
  /** Quién recibe; por defecto "Dirección". */
  receivedBy?: string | null;
  note?: string | null;
}>;
/** Efectivo cobrado en un período, para precargar la entrega. */
export type CashCollectedDto = Readonly<{ fromDate: string; toDate: string; collected: string }>;

export type CashShiftStatusDto = 'OPEN' | 'CLOSED';
/** REFUND: devolución de saldo a favor (egreso). */
export type CashMovementTypeDto = 'COLLECTION' | 'REVERSAL' | 'REFUND';
export type CashAmountByMethodDto = Readonly<Record<PaymentMethodDto, string>>;
export type CashMovementDto = Readonly<{
  id: string;
  type: CashMovementTypeDto;
  method: PaymentMethodDto;
  amount: string;
  paymentId: string;
  /** Null en la clase suelta de un alumno eventual (ver walkInName). */
  student: Readonly<{ id: string; firstName: string; lastName: string }> | null;
  walkInName: string | null;
  actor: Readonly<{ id: string; username: string }>;
  reason: string | null;
  createdAt: string;
}>;
export type CashShiftClosingLineDto = Readonly<{
  method: PaymentMethodDto;
  expectedAmount: string;
  declaredAmount: string;
  differenceAmount: string;
}>;
export type CashReconciliationCorrectionDto = Readonly<{
  id: string;
  method: PaymentMethodDto;
  amountDelta: string;
  originalDeclaredAmount: string;
  correctedDeclaredAmount: string;
  reason: string;
  createdBy: Readonly<{ id: string; username: string }>;
  createdAt: string;
}>;
export type CashShiftDto = Readonly<{
  id: string;
  user: Readonly<{ id: string; username: string }>;
  status: CashShiftStatusDto;
  openedAt: string;
  closedAt: string | null;
  expectedByMethod: CashAmountByMethodDto;
  operationCount: number;
  movements: readonly CashMovementDto[];
  closingLines: readonly CashShiftClosingLineDto[];
  corrections: readonly CashReconciliationCorrectionDto[];
  correctedByMethod: readonly CashShiftClosingLineDto[];
  hasPostCloseMovements: boolean;
}>;
export type CashShiftSummaryDto = Readonly<{
  id: string;
  user: Readonly<{ id: string; username: string }>;
  status: CashShiftStatusDto;
  openedAt: string;
  closedAt: string | null;
  expectedAmount: string;
  declaredAmount: string | null;
  differenceAmount: string | null;
  hasCorrections: boolean;
}>;
export type CashShiftListDto = PageDto<CashShiftSummaryDto>;
export type OpenCashShiftDto = Readonly<Record<string, never>>;
export type CloseCashShiftDto = Readonly<{ declaredByMethod: CashAmountByMethodDto }>;
export type CreateCashCorrectionDto = Readonly<{
  method: PaymentMethodDto;
  correctedDeclaredAmount: string;
  reason: string;
}>;
export type CashConsolidationDto = Readonly<{
  shiftCount: number;
  byMethod: readonly Readonly<{
    method: PaymentMethodDto;
    systemAtClose: string;
    declaredAtClose: string;
    differenceAtClose: string;
    postCloseMovements: string;
    currentSystem: string;
    correctedDeclared: string;
    currentDifference: string;
  }>[];
}>;

export type AuditActionDto =
  | 'UPDATE'
  | 'STATUS_CHANGE'
  | 'VOID'
  | 'END'
  | 'CORRECTION'
  | 'OPEN'
  | 'CLOSE'
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
  | 'CASH_SHIFT'
  | 'ATTENDANCE'
  | 'ENROLLMENT'
  | 'BILLING_CONDITION'
  | 'MONTHLY_CHARGE_ADJUSTMENT'
  | 'CASH_HANDOVER'
  | 'PAYMENT_CONCEPT'
  | 'COLLECTION_CLOSING';
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
  /** Horario de la clase. Null = asistencia fuera de horario (la clase no se dicta ese día). */
  scheduleId: string | null;
  status: AttendanceStatusDto;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type CreateAttendanceDto = Readonly<{
  enrollmentId: string;
  attendanceDate: string;
  /** Obligatorio solo si la clase tiene varios horarios ese día. */
  scheduleId?: string | null;
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
  scheduleId: string | null;
  date: string;
  items: readonly AttendanceRosterItemDto[];
}>;

export type AttendanceDayClassDto = Readonly<{
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

export type SelfCheckInRequestDto = Readonly<{ dni: string }>;
export type SelfCheckInOutcomeDto =
  | 'CHECKED_IN'
  | 'ALREADY_CHECKED_IN'
  | 'NO_CLASS_NOW'
  | 'STUDENT_NOT_FOUND';
export type SelfCheckInPaymentStatusDto = 'UP_TO_DATE' | 'OVERDUE';
export type SelfCheckInDto = Readonly<{
  outcome: SelfCheckInOutcomeDto;
  student: Readonly<{ firstName: string; lastName: string }> | null;
  class: Readonly<{
    name: string;
    startTime: string;
    endTime: string;
    teacherName: string;
    roomName: string;
  }> | null;
  paymentStatus: SelfCheckInPaymentStatusDto | null;
}>;

export type AttendanceDayDto = Readonly<{
  date: string;
  items: readonly AttendanceDayClassDto[];
}>;

export type SaveAttendanceRosterDto = Readonly<{
  classId: string;
  /** Obligatorio solo si la clase tiene varios horarios ese día. */
  scheduleId?: string | null;
  date: string;
  attendances: readonly Readonly<{
    enrollmentId: string;
    status: AttendanceStatusDto;
    notes?: string | null;
  }>[];
}>;

export type SaveAttendanceRosterResultDto = Readonly<{
  classId: string;
  scheduleId: string | null;
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
  /** Horarios de la clase en el día elegido, cada uno con su asistencia. */
  daySessions: readonly Readonly<{
    scheduleId: string;
    startTime: string;
    endTime: string;
    roomName: string;
    attendance: AttendanceDto | null;
  }>[];
  /** Asistencia fuera de horario (la clase no se dicta ese día). */
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
  followUp?: Readonly<{ students: number }>;
  classes?: Readonly<{
    active: number;
    /** Horarios de hoy: una clase con dos horarios en el día cuenta dos veces. */
    scheduledToday: number;
    today: readonly Readonly<{
      id: string;
      name: string;
      startTime: string;
      endTime: string;
      teacher: string;
      room: string;
      branch: string;
      /** Inscripciones activas vigentes en el día operativo. */
      enrolledStudents: number;
      /** Registros de asistencia del día para la clase; null sin permiso de asistencia. */
      attendanceRecords: number | null;
    }>[];
  }>;
  billing?: Readonly<{
    pendingCharges: number;
    pendingDebt: string;
    overdueCharges: number;
    overdueStudents: number;
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

/** Liquidación de profesores (decisiones 227 a 231). */
export type SettlementShareDto = Readonly<{
  teacher: Readonly<{ id: string; firstName: string; lastName: string }>;
  percentage: string;
}>;
export type ClassSettlementPlanDto = Readonly<{
  id: string;
  classId: string;
  /** Mes desde el que rige (AAAA-MM). */
  validFrom: string;
  reason: string | null;
  shares: readonly SettlementShareDto[];
  /** Lo que queda para la academia (100 menos lo repartido). */
  academyPercentage: string;
  createdBy: Readonly<{ id: string; username: string }>;
  createdAt: string;
}>;
export type SaveClassSettlementPlanDto = Readonly<{
  validFrom: string;
  shares: readonly Readonly<{ teacherId: string; percentage: string }>[];
  reason?: string;
}>;
export type ClassSettlementOverviewDto = Readonly<{
  academicClass: Readonly<{
    id: string;
    name: string;
    status: RecordStatusDto;
    teachers: readonly Readonly<{ id: string; firstName: string; lastName: string }>[];
  }>;
  /** Reparto vigente en el mes consultado; null si la clase todavía no tiene. */
  plan: ClassSettlementPlanDto | null;
  /** Repartos que empiezan después del mes consultado. */
  upcoming: readonly ClassSettlementPlanDto[];
}>;
export type SettlementConceptDto = 'MONTHLY' | 'HISTORICAL_DEBT' | 'SINGLE_CLASS';
export type SettlementLineDto = Readonly<{
  paymentId: string;
  paidAt: string;
  studentName: string;
  className: string;
  concept: SettlementConceptDto;
  chargePeriod: string | null;
  collected: string;
  base: string;
  percentage: string;
  amount: string;
}>;
export type SettlementTeacherDto = Readonly<{
  teacher: Readonly<{ id: string; firstName: string; lastName: string }>;
  total: string;
  lines: readonly SettlementLineDto[];
}>;
export type SettlementDto = Readonly<{
  period: string;
  status: 'OPEN' | 'CLOSED';
  /** Solo se cierra un mes terminado. */
  canClose: boolean;
  generatedAt: string;
  closedAt: string | null;
  closedBy: Readonly<{ id: string; username: string }> | null;
  note: string | null;
  totals: Readonly<{
    collected: string;
    classIncome: string;
    otherIncome: string;
    teachers: string;
    academy: string;
  }>;
  teachers: readonly SettlementTeacherDto[];
  unconfigured: readonly Readonly<{
    classId: string;
    className: string;
    period: string;
    collected: string;
  }>[];
}>;
export type CloseSettlementDto = Readonly<{ note?: string }>;
export type ReopenSettlementDto = Readonly<{ reason: string }>;
