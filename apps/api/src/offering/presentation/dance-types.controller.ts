import type { CreateDanceTypeDto, UpdateDanceTypeDto } from '@academy/contracts';
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
import { parseStatus, parseUuid } from '../../shared/presentation/request-validation';
import { CatalogService } from '../application/catalog.service';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
@Controller('dance-types')
export class DanceTypesController {
  constructor(@Inject(CatalogService) private readonly service: CatalogService) {}
  @Get() @Permissions('offering:read') list(@Query('status') status?: string) {
    return this.service.listDanceTypes(parseStatus(status));
  }
  @Get(':id') @Permissions('offering:read') get(@Param('id') id: string) {
    return this.service.getDanceType(parseUuid(id));
  }
  @Post() @Permissions('offering:manage') create(@Body() input: CreateDanceTypeDto) {
    return this.service.createDanceType(input);
  }
  @Patch(':id') @Permissions('offering:manage') update(
    @Param('id') id: string,
    @Body() input: UpdateDanceTypeDto,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.updateDanceType(parseUuid(id), input, user.id);
  }
  @Delete(':id') @HttpCode(200) @Permissions('offering:manage') deactivate(
    @Param('id') id: string,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.updateDanceType(parseUuid(id), { status: 'INACTIVE' }, user.id);
  }
  @Post(':id/reactivate') @Permissions('offering:manage') reactivate(
    @Param('id') id: string,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.updateDanceType(parseUuid(id), { status: 'ACTIVE' }, user.id);
  }
}
