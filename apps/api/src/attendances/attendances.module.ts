import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { ATTENDANCE_REPOSITORY } from './application/attendance.repository';
import { AttendancesService } from './application/attendances.service';
import { SELF_CHECK_IN_REPOSITORY } from './application/self-check-in.repository';
import { SelfCheckInService } from './application/self-check-in.service';
import { PrismaAttendanceRepository } from './infrastructure/prisma-attendance.repository';
import { PrismaSelfCheckInRepository } from './infrastructure/prisma-self-check-in.repository';
import { AttendancesController } from './presentation/attendances.controller';
import { SelfCheckInController } from './presentation/self-check-in.controller';

@Module({
  imports: [DatabaseModule, EnrollmentsModule],
  controllers: [SelfCheckInController, AttendancesController],
  providers: [
    AttendancesService,
    { provide: ATTENDANCE_REPOSITORY, useClass: PrismaAttendanceRepository },
    SelfCheckInService,
    { provide: SELF_CHECK_IN_REPOSITORY, useClass: PrismaSelfCheckInRepository },
  ],
})
export class AttendancesModule {}
