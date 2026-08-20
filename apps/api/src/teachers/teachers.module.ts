import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TEACHER_REPOSITORY } from './application/teacher.repository';
import { TeachersService } from './application/teachers.service';
import { PrismaTeacherRepository } from './infrastructure/prisma-teacher.repository';
import { TeachersController } from './presentation/teachers.controller';
@Module({
  imports: [DatabaseModule],
  controllers: [TeachersController],
  providers: [
    TeachersService,
    PrismaTeacherRepository,
    { provide: TEACHER_REPOSITORY, useExisting: PrismaTeacherRepository },
  ],
})
export class TeachersModule {}
