import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StudentsService } from './application/students.service';
import { STUDENT_REPOSITORY } from './application/student.repository';
import { PrismaStudentRepository } from './infrastructure/prisma-student.repository';
import { StudentsController } from './presentation/students.controller';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { STUDENT_ONBOARDING_TRANSACTION } from './application/student-onboarding.transaction';
import { StudentOnboardingService } from './application/student-onboarding.service';
import { PrismaStudentOnboardingTransaction } from './infrastructure/prisma-student-onboarding.transaction';

@Module({
  imports: [DatabaseModule, EnrollmentsModule],
  controllers: [StudentsController],
  providers: [
    StudentsService,
    StudentOnboardingService,
    PrismaStudentOnboardingTransaction,
    { provide: STUDENT_ONBOARDING_TRANSACTION, useExisting: PrismaStudentOnboardingTransaction },
    PrismaStudentRepository,
    { provide: STUDENT_REPOSITORY, useExisting: PrismaStudentRepository },
  ],
})
export class StudentsModule {}
