import type {
  CreateStudentOnboardingDto,
  StudentDto,
  StudentOnboardingResultDto,
} from '@academy/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { Prisma } from '@academy/database';
import {
  STUDENT_ONBOARDING_TRANSACTION,
  type StudentOnboardingTransaction,
} from './student-onboarding.transaction';

const businessDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};

@Injectable()
export class StudentOnboardingService {
  constructor(
    @Inject(STUDENT_ONBOARDING_TRANSACTION)
    private readonly transaction: StudentOnboardingTransaction,
  ) {}

  create(input: CreateStudentOnboardingDto, actorId: string): Promise<StudentOnboardingResultDto> {
    const selections = input.enrollments ?? [];
    if (new Set(selections.map(({ classId }) => classId)).size !== selections.length)
      throw new DomainError(
        'ONBOARDING_DUPLICATE_CLASS',
        'No se puede seleccionar la misma clase más de una vez',
      );
    if (selections.length === 0 && input.payment)
      throw new DomainError('PAYMENT_NO_CHARGES', 'No se puede cobrar sin cuotas iniciales');
    if (selections.length > 0 && (!input.period || !input.dueDate))
      throw new DomainError(
        'VALIDATION_ERROR',
        'El período y vencimiento son obligatorios al inscribir clases',
      );

    return this.transaction.execute(async ({ students, enrollments, billing, payments }) => {
      const createdStudent = await students.create(input.student);
      const createdEnrollments = [];
      const charges = [];
      for (const selection of [...selections].sort((a, b) => a.classId.localeCompare(b.classId))) {
        const enrollment = await enrollments.create({
          studentId: createdStudent.id,
          classId: selection.classId,
          startDate: businessDate(),
        });
        createdEnrollments.push(enrollment);
        charges.push(
          await billing.createCharge({
            enrollmentId: enrollment.id,
            tariffId: selection.tariffId,
            period: input.period!,
            dueDate: input.dueDate!,
          }),
        );
      }
      const payment = input.payment
        ? await payments.create(
            {
              studentId: createdStudent.id,
              tenders: [
                {
                  method: input.payment.paymentMethod,
                  amount: charges
                    .reduce(
                      (total, charge) => total.plus(charge.finalAmount),
                      new Prisma.Decimal(0),
                    )
                    .toFixed(2),
                },
              ],
            },
            actorId,
          )
        : null;
      const student: StudentDto = {
        ...createdStudent,
        birthDate: createdStudent.birthDate?.toISOString().slice(0, 10) ?? null,
        joinedAt: createdStudent.joinedAt.toISOString().slice(0, 10),
        createdAt: createdStudent.createdAt.toISOString(),
        updatedAt: createdStudent.updatedAt.toISOString(),
      };
      return { student, enrollments: createdEnrollments, charges, payment };
    });
  }
}
