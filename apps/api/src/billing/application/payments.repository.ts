import type { PaymentDto, PaymentMethodDto, PaymentStatusDto } from '@academy/contracts';

export const PAYMENTS_REPOSITORY = Symbol('PAYMENTS_REPOSITORY');

export type PaymentQuery = Readonly<{
  studentId?: string;
  status?: PaymentStatusDto;
  paymentMethod?: PaymentMethodDto;
  page: number;
  pageSize: number;
}>;

export interface PaymentsRepository {
  create(
    studentId: string,
    tenders: readonly Readonly<{ method: PaymentMethodDto; amount: string }>[],
    actorId: string,
  ): Promise<PaymentDto>;
  findById(id: string): Promise<PaymentDto | null>;
  findPage(
    query: PaymentQuery,
  ): Promise<{ items: PaymentDto[]; total: number; page: number; pageSize: number }>;
  confirmedTotal(studentId: string): Promise<string>;
  void(id: string, actorId: string, reason: string): Promise<PaymentDto>;
}
