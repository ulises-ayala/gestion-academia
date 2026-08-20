import type { CreateDanceTypeDto, UpdateDanceTypeDto } from '@academy/contracts';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { parseStatus, parseUuid } from '../../shared/presentation/request-validation';
import { CatalogService } from '../application/catalog.service';
@Controller('dance-types')
export class DanceTypesController {
  constructor(@Inject(CatalogService) private readonly service: CatalogService) {}
  @Get() list(@Query('status') status?: string) { return this.service.listDanceTypes(parseStatus(status)); }
  @Get(':id') get(@Param('id') id: string) { return this.service.getDanceType(parseUuid(id)); }
  @Post() create(@Body() input: CreateDanceTypeDto) { return this.service.createDanceType(input); }
  @Patch(':id') update(@Param('id') id: string, @Body() input: UpdateDanceTypeDto) { return this.service.updateDanceType(parseUuid(id), input); }
  @Delete(':id') @HttpCode(200) deactivate(@Param('id') id: string) { return this.service.updateDanceType(parseUuid(id), { status: 'INACTIVE' }); }
  @Post(':id/reactivate') reactivate(@Param('id') id: string) { return this.service.updateDanceType(parseUuid(id), { status: 'ACTIVE' }); }
}
