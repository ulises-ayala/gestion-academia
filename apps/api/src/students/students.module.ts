import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StudentsService } from './application/students.service';
import { STUDENT_REPOSITORY } from './application/student.repository';
import { PrismaStudentRepository } from './infrastructure/prisma-student.repository';
import { StudentsController } from './presentation/students.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [StudentsController],
  providers: [
    StudentsService,
    PrismaStudentRepository,
    { provide: STUDENT_REPOSITORY, useExisting: PrismaStudentRepository },
  ],
})
export class StudentsModule {}
