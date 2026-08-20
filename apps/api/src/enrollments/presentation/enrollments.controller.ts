import type {
  CreateEnrollmentDto,
  EndEnrollmentDto,
  EnrollmentStatusDto,
} from '@academy/contracts';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { parsePage, parseUuid } from '../../shared/presentation/request-validation';
import { EnrollmentsService } from '../application/enrollments.service';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}
  @Get() list(
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('status') status?: EnrollmentStatusDto,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      ...(studentId ? { studentId: parseUuid(studentId) } : {}),
      ...(classId ? { classId: parseUuid(classId) } : {}),
      ...(status ? { status } : {}),
      page: parsePage(page, 'page', 1, 1_000_000),
      pageSize: parsePage(pageSize, 'pageSize', 25, 100),
    });
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.service.get(parseUuid(id));
  }
  @Post() create(@Body() body: CreateEnrollmentDto) {
    return this.service.create({
      ...body,
      studentId: parseUuid(body.studentId),
      classId: parseUuid(body.classId),
    });
  }
  @Post(':id/end') end(@Param('id') id: string, @Body() body: EndEnrollmentDto) {
    return this.service.end(parseUuid(id), body);
  }
}
