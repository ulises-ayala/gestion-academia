import type { BillingService } from '../../billing/application/billing.service';
import type { PaymentsService } from '../../billing/application/payments.service';
import type { EnrollmentsService } from '../../enrollments/application/enrollments.service';
import type { StudentsService } from './students.service';

export const STUDENT_ONBOARDING_TRANSACTION = Symbol('STUDENT_ONBOARDING_TRANSACTION');
export type StudentOnboardingOperations = Readonly<{
  students: StudentsService;
  enrollments: EnrollmentsService;
  billing: BillingService;
  payments: PaymentsService;
}>;
export interface StudentOnboardingTransaction {
  execute<T>(work: (operations: StudentOnboardingOperations) => Promise<T>): Promise<T>;
}
