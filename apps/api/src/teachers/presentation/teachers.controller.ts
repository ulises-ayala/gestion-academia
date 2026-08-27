import type { CreateTeacherDto, UpdateTeacherDto } from '@academy/contracts';
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
import { DomainError } from '../../shared/domain/domain-error';
import { parsePage, parseStatus, parseUuid } from '../../shared/presentation/request-validation';
import { TeachersService } from '../application/teachers.service';
import { Permissions } from '../../auth/presentation/permissions.decorator';
@Controller('teachers')
export class TeachersController {
  constructor(@Inject(TeachersService) private readonly service: TeachersService) {}
  @Get() @Permissions('offering:read') list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (q && q.trim().length > 100)
      throw new DomainError('VALIDATION_ERROR', 'La búsqueda no puede superar 100 caracteres', {
        field: 'q',
      });
    const parsedStatus = parseStatus(status);
    return this.service.list({
      ...(q?.trim() ? { q: q.trim() } : {}),
      ...(parsedStatus ? { status: parsedStatus } : {}),
      page: parsePage(page, 'page', 1, Number.MAX_SAFE_INTEGER),
      pageSize: parsePage(pageSize, 'pageSize', 25, 100),
    });
  }
  @Get(':id') @Permissions('offering:read') get(@Param('id') id: string) {
    return this.service.get(parseUuid(id));
  }
  @Post() @Permissions('offering:manage') create(@Body() input: CreateTeacherDto) {
    return this.service.create(input);
  }
  @Patch(':id') @Permissions('offering:manage') update(
    @Param('id') id: string,
    @Body() input: UpdateTeacherDto,
  ) {
    return this.service.update(parseUuid(id), input);
  }
  @Delete(':id') @HttpCode(200) @Permissions('offering:manage') deactivate(
    @Param('id') id: string,
  ) {
    return this.service.deactivate(parseUuid(id));
  }
  @Post(':id/reactivate') @Permissions('offering:manage') reactivate(@Param('id') id: string) {
    return this.service.reactivate(parseUuid(id));
  }
}
