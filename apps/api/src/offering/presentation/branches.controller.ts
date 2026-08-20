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
@Controller('branches')
export class BranchesController {
  constructor(@Inject(CatalogService) private readonly service: CatalogService) {}
  @Get() list(@Query('status') status?: string) {
    return this.service.listBranches(parseStatus(status));
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.service.getBranch(parseUuid(id));
  }
  @Post() create(@Body() input: CreateBranchDto) {
    return this.service.createBranch(input);
  }
  @Patch(':id') update(@Param('id') id: string, @Body() input: UpdateBranchDto) {
    return this.service.updateBranch(parseUuid(id), input);
  }
  @Delete(':id') @HttpCode(200) deactivate(@Param('id') id: string) {
    return this.service.updateBranch(parseUuid(id), { status: 'INACTIVE' });
  }
  @Post(':id/reactivate') reactivate(@Param('id') id: string) {
    return this.service.updateBranch(parseUuid(id), { status: 'ACTIVE' });
  }
}
