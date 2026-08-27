import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { ATTENDANCE_REPOSITORY } from './application/attendance.repository';
import { AttendancesService } from './application/attendances.service';
import { PrismaAttendanceRepository } from './infrastructure/prisma-attendance.repository';
import { AttendancesController } from './presentation/attendances.controller';

@Module({
  imports: [DatabaseModule, EnrollmentsModule],
  controllers: [AttendancesController],
  providers: [
    AttendancesService,
    { provide: ATTENDANCE_REPOSITORY, useClass: PrismaAttendanceRepository },
  ],
})
export class AttendancesModule {}
