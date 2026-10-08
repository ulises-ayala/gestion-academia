import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { parsePage, parseUuid } from '../../shared/presentation/request-validation';
import { parseFollowUpFilters } from '../domain/student-follow-up';
import { PrismaStudentFollowUpReader } from '../infrastructure/prisma-student-follow-up.reader';

@Controller('students')
@Permissions('students:manage')
export class StudentFollowUpController {
  constructor(
    @Inject(PrismaStudentFollowUpReader) private readonly reader: PrismaStudentFollowUpReader,
  ) {}

  @Get('follow-up')
  list(
    @Query('q') q?: string,
    @Query('classId') classId?: string,
    @Query('minAbsences') minAbsences?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reader.list({
      ...parseFollowUpFilters(q, minAbsences),
      ...(classId ? { classId: parseUuid(classId, 'classId') } : {}),
      page: parsePage(page, 'page', 1, 1_000_000),
      pageSize: parsePage(pageSize, 'pageSize', 25, 100),
    });
  }

  @Get(':id/follow-up')
  forStudent(@Param('id') id: string) {
    return this.reader.forStudent(parseUuid(id));
  }
}
