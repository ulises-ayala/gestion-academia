import type { MonthlyChargeDto, TariffDto } from '@academy/contracts';

export const BILLING_REPOSITORY = Symbol('BILLING_REPOSITORY');

export type ChargeQuery = Readonly<{
  studentId?: string;
  period?: string;
  status?: 'PENDING' | 'PAID' | 'VOID';
}>;
export type EnrollmentForCharge = Readonly<{
  id: string;
  studentId: string;
  status: 'ACTIVE' | 'ENDED';
}>;

export interface BillingRepository {
  listTariffs(status?: 'ACTIVE' | 'INACTIVE'): Promise<TariffDto[]>;
  findTariff(id: string): Promise<TariffDto | null>;
  createTariff(data: Omit<TariffDto, 'id' | 'createdAt' | 'updatedAt'>): Promise<TariffDto>;
  updateTariff(
    id: string,
    data: Omit<TariffDto, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TariffDto>;
  findEnrollment(id: string): Promise<EnrollmentForCharge | null>;
  createCharge(data: {
    studentId: string;
    enrollmentId: string;
    tariffId: string;
    period: string;
    baseAmount: string;
    discountAmount: string;
    finalAmount: string;
    dueDate: string;
  }): Promise<MonthlyChargeDto>;
  findCharge(id: string): Promise<MonthlyChargeDto | null>;
  listCharges(query: ChargeQuery): Promise<{ items: MonthlyChargeDto[]; total: number }>;
}
