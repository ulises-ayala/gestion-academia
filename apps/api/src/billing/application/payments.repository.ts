import type {
  OtherPaymentConceptDto,
  PaymentDto,
  PaymentMethodDto,
  PaymentStatusDto,
} from '@academy/contracts';

export const PAYMENTS_REPOSITORY = Symbol('PAYMENTS_REPOSITORY');

export type PaymentQuery = Readonly<{
  studentId?: string;
  status?: PaymentStatusDto;
  paymentMethod?: PaymentMethodDto;
  q?: string;
  from?: Date;
  toExclusive?: Date;
  page: number;
  pageSize: number;
}>;

export interface PaymentsRepository {
  /**
   * paidAt: fecha real de un pago cargado tarde (si falta, ahora). monthlyChargeIds: cuotas
   * elegidas (si falta, se imputa desde la deuda más antigua).
   */
  create(
    studentId: string,
    tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[],
    actorId: string,
    paidAt?: Date,
    monthlyChargeIds?: readonly string[],
    /** Recargo por tarjeta: otro cobro "Recargo por tarjeta" en la misma transacción. */
    cardSurcharge?: string,
    /** Lo que supere la deuda queda como saldo a favor del pago (si no, se rechaza). */
    allowCredit?: boolean,
  ): Promise<PaymentDto>;
  /**
   * Cobro que no se imputa a cuotas; igual exige turno de caja abierto. Lleva alumno o, solo en la
   * clase suelta, un alumno eventual.
   */
  createOther(
    data: Readonly<{
      studentId: string | null;
      walkIn: Readonly<{ name: string; phone: string | null; dni: string | null }> | null;
      concept: OtherPaymentConceptDto;
      conceptId: string | null;
      classId: string | null;
      teacherId: string | null;
      detail: string | null;
    }>,
    tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[],
    actorId: string,
    paidAt?: Date,
  ): Promise<PaymentDto>;
  /** Estado y profesor actual de la clase de una clase suelta, o null si no existe. */
  findClass(classId: string): Promise<{ status: 'ACTIVE' | 'INACTIVE'; teacherId: string } | null>;
  findTeacherStatus(teacherId: string): Promise<'ACTIVE' | 'INACTIVE' | null>;
  /** Concepto del catálogo, o null si no existe. */
  findConcept(
    conceptId: string,
  ): Promise<{ status: 'ACTIVE' | 'INACTIVE'; requiresDetail: boolean } | null>;
  findById(id: string): Promise<PaymentDto | null>;
  findPage(
    query: PaymentQuery,
  ): Promise<{ items: PaymentDto[]; total: number; page: number; pageSize: number }>;
  confirmedTotal(studentId: string): Promise<string>;
  void(id: string, actorId: string, reason: string): Promise<PaymentDto>;
  /**
   * Anula el pago y registra su reemplazo con los medios, el importe o la fecha correctos, en una
   * transacción. Los movimientos de caja (reversa y nuevo cobro) van al turno del pago original.
   */
  correct(
    id: string,
    input: Readonly<{
      tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[];
      paidAt: Date;
    }>,
    actorId: string,
    reason: string,
  ): Promise<PaymentDto>;
  /**
   * Cambia las cuotas a las que se imputó el pago (imputación completa nueva), sin tocar el pago ni
   * la caja: agrega filas negativas y positivas ligadas a una reimputación con motivo.
   */
  reallocate(
    id: string,
    allocations: readonly Readonly<{ monthlyChargeId: string; amount: string }>[],
    actorId: string,
    reason: string,
  ): Promise<PaymentDto>;
  /** Devuelve saldo a favor del pago: egreso REFUND en el turno abierto de quien devuelve. */
  refund(
    id: string,
    input: Readonly<{ amount: string; method: PaymentMethodDto; fromCashShift: boolean }>,
    actorId: string,
    reason: string,
  ): Promise<PaymentDto>;
  /**
   * Usa el saldo a favor del alumno en sus cuotas pendientes (reimputación de cada pago con saldo,
   * de la cuota más vieja a la más nueva). No toca la caja.
   */
  applyCredit(studentId: string, actorId: string, reason: string): Promise<{ applied: string }>;
  /** Saldo a favor del alumno: lo no imputado ni devuelto de sus pagos de cuotas. */
  creditTotal(studentId: string): Promise<string>;
}
