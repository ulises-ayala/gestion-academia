import type { CreateBranchDto, UpdateBranchDto } from '@academy/contracts';
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
@Controller('branches')
export class BranchesController {
  constructor(@Inject(CatalogService) private readonly service: CatalogService) {}
  @Get() @Permissions('offering:read') list(@Query('status') status?: string) {
    return this.service.listBranches(parseStatus(status));
  }
  @Get(':id') @Permissions('offering:read') get(@Param('id') id: string) {
    return this.service.getBranch(parseUuid(id));
  }
  @Post() @Permissions('offering:manage') create(@Body() input: CreateBranchDto) {
    return this.service.createBranch(input);
  }
  @Patch(':id') @Permissions('offering:manage') update(
    @Param('id') id: string,
    @Body() input: UpdateBranchDto,
  ) {
    return this.service.updateBranch(parseUuid(id), input);
  }
  @Delete(':id') @HttpCode(200) @Permissions('offering:manage') deactivate(
    @Param('id') id: string,
  ) {
    return this.service.updateBranch(parseUuid(id), { status: 'INACTIVE' });
  }
  @Post(':id/reactivate') @Permissions('offering:manage') reactivate(@Param('id') id: string) {
    return this.service.updateBranch(parseUuid(id), { status: 'ACTIVE' });
  }
}
