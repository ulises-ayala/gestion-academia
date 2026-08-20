import type { CreateRoomDto, UpdateRoomDto } from '@academy/contracts';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { parseStatus, parseUuid } from '../../shared/presentation/request-validation';
import { CatalogService } from '../application/catalog.service';
@Controller('rooms')
export class RoomsController {
  constructor(@Inject(CatalogService) private readonly service: CatalogService) {}
  @Get() list(@Query('status') status?: string, @Query('branchId') branchId?: string) { return this.service.listRooms(parseStatus(status), branchId ? parseUuid(branchId, 'branchId') : undefined); }
  @Get(':id') get(@Param('id') id: string) { return this.service.getRoom(parseUuid(id)); }
  @Post() create(@Body() input: CreateRoomDto) { return this.service.createRoom(input); }
  @Patch(':id') update(@Param('id') id: string, @Body() input: UpdateRoomDto) { return this.service.updateRoom(parseUuid(id), input); }
  @Delete(':id') @HttpCode(200) deactivate(@Param('id') id: string) { return this.service.updateRoom(parseUuid(id), { status: 'INACTIVE' }); }
  @Post(':id/reactivate') reactivate(@Param('id') id: string) { return this.service.updateRoom(parseUuid(id), { status: 'ACTIVE' }); }
}
