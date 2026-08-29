import type { CreateClassDto, UpdateClassDto } from '@academy/contracts';
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
import { ClassesService } from '../application/classes.service';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
@Controller('classes')
export class ClassesController {
  constructor(@Inject(ClassesService) private readonly service: ClassesService) {}
  @Get() @Permissions('offering:read') list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('danceTypeId') danceTypeId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('branchId') branchId?: string,
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
      ...(danceTypeId ? { danceTypeId: parseUuid(danceTypeId, 'danceTypeId') } : {}),
      ...(teacherId ? { teacherId: parseUuid(teacherId, 'teacherId') } : {}),
      ...(branchId ? { branchId: parseUuid(branchId, 'branchId') } : {}),
      page: parsePage(page, 'page', 1, Number.MAX_SAFE_INTEGER),
      pageSize: parsePage(pageSize, 'pageSize', 25, 100),
    });
  }
  @Get(':id') @Permissions('offering:read') get(@Param('id') id: string) {
    return this.service.get(parseUuid(id));
  }
  @Post() @Permissions('offering:manage') create(@Body() input: CreateClassDto) {
    return this.service.create(input);
  }
  @Patch(':id') @Permissions('offering:manage') update(
    @Param('id') id: string,
    @Body() input: UpdateClassDto,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.update(parseUuid(id), input, user.id);
  }
  @Delete(':id') @HttpCode(200) @Permissions('offering:manage') deactivate(
    @Param('id') id: string,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.deactivate(parseUuid(id), user.id);
  }
  @Post(':id/reactivate') @Permissions('offering:manage') reactivate(
    @Param('id') id: string,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.reactivate(parseUuid(id), user.id);
  }
}
