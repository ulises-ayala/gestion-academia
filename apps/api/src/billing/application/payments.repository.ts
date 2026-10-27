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
  create(
    studentId: string,
    tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[],
    actorId: string,
  ): Promise<PaymentDto>;
  /** Cobro que no se imputa a cuotas; igual exige turno de caja abierto. */
  createOther(
    data: Readonly<{
      studentId: string;
      concept: OtherPaymentConceptDto;
      classId: string | null;
      detail: string | null;
    }>,
    tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[],
    actorId: string,
  ): Promise<PaymentDto>;
  /** Estado de la clase de una clase suelta, o null si no existe. */
  findClassStatus(classId: string): Promise<'ACTIVE' | 'INACTIVE' | null>;
  findById(id: string): Promise<PaymentDto | null>;
  findPage(
    query: PaymentQuery,
  ): Promise<{ items: PaymentDto[]; total: number; page: number; pageSize: number }>;
  confirmedTotal(studentId: string): Promise<string>;
  void(id: string, actorId: string, reason: string): Promise<PaymentDto>;
}
