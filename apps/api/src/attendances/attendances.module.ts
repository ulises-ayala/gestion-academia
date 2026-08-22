import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

import { ATTENDANCE_REPOSITORY } from './application/attendance.repository';
import { PrismaAttendanceRepository } from './infrastructure/prisma-attendance.repository';
import { AttendancesService } from './application/attendances.service';
import { AttendancesController } from './presentation/attendances.controller';

@Module({
  imports: [DatabaseModule, EnrollmentsModule],
  controllers: [AttendancesController],
  providers: [
    AttendancesService,
    {
      provide: ATTENDANCE_REPOSITORY,
      useClass: PrismaAttendanceRepository,
    },
  ],
    exports: [AttendancesService],
})
export class AttendancesModule {}

// Una asistencia pertenece a una inscripción.

// Solo puede existir una asistencia por inscripción y fecha.

// Estados posibles:
// - PRESENT
// - ABSENT
// - JUSTIFIED

// Se puede corregir una asistencia ya cargada.

// No se elimina físicamente una inscripción histórica.

// La asistencia mantiene el historial aunque después
// la inscripción finalice.