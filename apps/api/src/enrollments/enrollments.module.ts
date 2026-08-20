import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ENROLLMENT_REPOSITORY } from './application/enrollment.repository';
import { EnrollmentsService } from './application/enrollments.service';
import { PrismaEnrollmentRepository } from './infrastructure/prisma-enrollment.repository';
import { EnrollmentsController } from './presentation/enrollments.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [EnrollmentsController],
  providers: [
    EnrollmentsService,
    { provide: ENROLLMENT_REPOSITORY, useClass: PrismaEnrollmentRepository },
  ],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
