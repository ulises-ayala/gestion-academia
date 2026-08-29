import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type {
  CreateStudentDto,
  CreateStudentOnboardingDto,
  UpdateStudentDto,
} from '@academy/contracts';
import { DomainError } from '../../shared/domain/domain-error';
import { StudentsService } from '../application/students.service';
import type { StudentStatus } from '../domain/student';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { hasPermissions, type Permission } from '../../auth/domain/permissions';
import { StudentOnboardingService } from '../application/student-onboarding.service';
import { parseUuid } from '../../shared/presentation/request-validation';

@Controller('students')
@Permissions('students:manage')
export class StudentsController {
  constructor(
    @Inject(StudentsService) private readonly students: StudentsService,
    @Inject(StudentOnboardingService) private readonly onboarding: StudentOnboardingService,
  ) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('page') pageValue?: string,
    @Query('pageSize') pageSizeValue?: string,
  ) {
    if (status !== undefined && status !== '' && status !== 'ACTIVE' && status !== 'INACTIVE') {
      throw new DomainError('VALIDATION_ERROR', 'El estado debe ser ACTIVE o INACTIVE', {
        field: 'status',
      });
    }
    if (q !== undefined && (typeof q !== 'string' || q.trim().length > 100)) {
      throw new DomainError('VALIDATION_ERROR', 'La búsqueda no puede superar los 100 caracteres', {
        field: 'q',
      });
    }
    const page = this.parsePositiveInteger(pageValue, 'page', 1, Number.MAX_SAFE_INTEGER);
    const pageSize = this.parsePositiveInteger(pageSizeValue, 'pageSize', 25, 100);
    return this.students.list({
      ...(q?.trim() ? { q: q.trim() } : {}),
      ...(status ? { status: status as StudentStatus } : {}),
      page,
      pageSize,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.students.get(this.parseId(id));
  }

  @Post()
  create(@Body() input: CreateStudentDto) {
    return this.students.create(input);
  }

  @Post('onboarding')
  createOnboarding(@Body() input: CreateStudentOnboardingDto, @CurrentUser() user: PublicAuthUser) {
    const selections = Array.isArray(input.enrollments) ? input.enrollments : [];
    const required: Permission[] = selections.length ? ['enrollments:manage'] : [];
    if (input.payment) required.push('payments:collect');
    if (!hasPermissions(user, required))
      throw new DomainError('FORBIDDEN', 'No tenés permisos para completar esta alta');
    return this.onboarding.create(
      {
        ...input,
        enrollments: selections.map((item) => ({
          classId: parseUuid(item.classId, 'classId'),
          tariffId: parseUuid(item.tariffId, 'tariffId'),
        })),
      },
      user.id,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() input: UpdateStudentDto,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.students.update(this.parseId(id), input, user?.id);
  }

  @Delete(':id')
  @HttpCode(200)
  deactivate(@Param('id') id: string, @CurrentUser() user: PublicAuthUser) {
    return this.students.deactivate(this.parseId(id), user?.id);
  }

  @Post(':id/reactivate')
  reactivate(@Param('id') id: string, @CurrentUser() user: PublicAuthUser) {
    return this.students.reactivate(this.parseId(id), user?.id);
  }

  private parseId(id: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new DomainError('VALIDATION_ERROR', 'El identificador del alumno no es válido', {
        field: 'id',
      });
    }
    return id;
  }

  private parsePositiveInteger(
    value: string | undefined,
    field: string,
    fallback: number,
    maximum: number,
  ): number {
    if (value === undefined || value === '') return fallback;
    if (!/^\d+$/.test(value))
      throw new DomainError('VALIDATION_ERROR', `${field} debe ser un entero positivo`, { field });
    const parsed = Number.parseInt(value, 10);
    if (parsed < 1 || parsed > maximum)
      throw new DomainError('VALIDATION_ERROR', `${field} debe estar entre 1 y ${maximum}`, {
        field,
      });
    return parsed;
  }
}
