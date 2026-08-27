import type { CreateRoomDto, UpdateRoomDto } from '@academy/contracts';
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
@Controller('rooms')
export class RoomsController {
  constructor(@Inject(CatalogService) private readonly service: CatalogService) {}
  @Get() @Permissions('offering:read') list(
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.service.listRooms(
      parseStatus(status),
      branchId ? parseUuid(branchId, 'branchId') : undefined,
    );
  }
  @Get(':id') @Permissions('offering:read') get(@Param('id') id: string) {
    return this.service.getRoom(parseUuid(id));
  }
  @Post() @Permissions('offering:manage') create(@Body() input: CreateRoomDto) {
    return this.service.createRoom(input);
  }
  @Patch(':id') @Permissions('offering:manage') update(
    @Param('id') id: string,
    @Body() input: UpdateRoomDto,
  ) {
    return this.service.updateRoom(parseUuid(id), input);
  }
  @Delete(':id') @HttpCode(200) @Permissions('offering:manage') deactivate(
    @Param('id') id: string,
  ) {
    return this.service.updateRoom(parseUuid(id), { status: 'INACTIVE' });
  }
  @Post(':id/reactivate') @Permissions('offering:manage') reactivate(@Param('id') id: string) {
    return this.service.updateRoom(parseUuid(id), { status: 'ACTIVE' });
  }
}
