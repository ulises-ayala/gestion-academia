import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import { BillingService } from '../../billing/application/billing.service';
import { PaymentsService } from '../../billing/application/payments.service';
import { PrismaBillingRepository } from '../../billing/infrastructure/prisma-billing.repository';
import { PrismaPaymentsRepository } from '../../billing/infrastructure/prisma-payments.repository';
import { PrismaService } from '../../database/prisma.service';
import { EnrollmentsService } from '../../enrollments/application/enrollments.service';
import { PrismaEnrollmentRepository } from '../../enrollments/infrastructure/prisma-enrollment.repository';
import { DomainError } from '../../shared/domain/domain-error';
import type {
  StudentOnboardingOperations,
  StudentOnboardingTransaction,
} from '../application/student-onboarding.transaction';
import { StudentsService } from '../application/students.service';
import { PrismaStudentRepository } from './prisma-student.repository';

const retryable = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === 'P2034' ||
    (error.code === 'P2010' && /40001|40P01|serializ|deadlock/i.test(JSON.stringify(error.meta))));

@Injectable()
export class PrismaStudentOnboardingTransaction implements StudentOnboardingTransaction {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(work: (operations: StudentOnboardingOperations) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => work(this.operations(tx)), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (retryable(error)) {
          if (attempt < 2) continue;
          throw new DomainError(
            'ONBOARDING_CONCURRENCY_CONFLICT',
            'No se pudo completar el alta porque los cupos cambiaron. Intentá nuevamente.',
          );
        }
        throw error;
      }
    }
    throw new DomainError(
      'ONBOARDING_CONCURRENCY_CONFLICT',
      'No se pudo completar el alta. Intentá nuevamente.',
    );
  }

  private operations(tx: Prisma.TransactionClient): StudentOnboardingOperations {
    const scoped = new Proxy(tx as object, {
      get(target, property) {
        if (property === '$transaction')
          return async (
            operation:
              | ((client: Prisma.TransactionClient) => Promise<unknown>)
              | readonly Promise<unknown>[],
          ) => (typeof operation === 'function' ? operation(tx) : Promise.all(operation));
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as PrismaService;
    return {
      students: new StudentsService(new PrismaStudentRepository(scoped)),
      enrollments: new EnrollmentsService(new PrismaEnrollmentRepository(scoped)),
      billing: new BillingService(new PrismaBillingRepository(scoped)),
      payments: new PaymentsService(new PrismaPaymentsRepository(scoped)),
    };
  }
}
