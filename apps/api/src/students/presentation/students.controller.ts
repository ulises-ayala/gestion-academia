import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { StudentsService } from '../application/students.service';
import type { StudentInput, StudentStatus } from '../domain/student';

@Controller('students')
export class StudentsController {
  constructor(@Inject(StudentsService) private readonly students: StudentsService) {}

  @Get()
  list(@Query('status') status?: string) {
    if (status !== undefined && status !== 'ACTIVE' && status !== 'INACTIVE') {
      throw new DomainError('VALIDATION_ERROR', 'El estado debe ser ACTIVE o INACTIVE', { field: 'status' });
    }
    return this.students.list(status as StudentStatus | undefined);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.students.get(this.parseId(id));
  }

  @Post()
  create(@Body() input: StudentInput) {
    return this.students.create(input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: Partial<StudentInput>) {
    return this.students.update(this.parseId(id), input);
  }

  @Delete(':id')
  @HttpCode(200)
  deactivate(@Param('id') id: string) {
    return this.students.deactivate(this.parseId(id));
  }

  private parseId(id: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new DomainError('VALIDATION_ERROR', 'El identificador del alumno no es válido', { field: 'id' });
    }
    return id;
  }
}
