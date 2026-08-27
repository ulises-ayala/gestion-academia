import type { CreateTariffDto, UpdateTariffDto } from '@academy/contracts';
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
import { BillingService } from '../application/billing.service';
import { Permissions } from '../../auth/presentation/permissions.decorator';

@Controller('tariffs')
export class TariffsController {
  constructor(@Inject(BillingService) private readonly service: BillingService) {}
  @Get() @Permissions('tariffs:read') list(@Query('status') status?: string) {
    return this.service.listTariffs(parseStatus(status));
  }
  @Get('active') @Permissions('tariffs:read') listActive() {
    return this.service.listTariffs('ACTIVE');
  }
  @Get(':id') @Permissions('tariffs:read') get(@Param('id') id: string) {
    return this.service.getTariff(parseUuid(id));
  }
  @Post() @Permissions('tariffs:manage') create(@Body() input: CreateTariffDto) {
    return this.service.createTariff(input);
  }
  @Patch(':id') @Permissions('tariffs:manage') update(
    @Param('id') id: string,
    @Body() input: UpdateTariffDto,
  ) {
    return this.service.updateTariff(parseUuid(id), input);
  }
  @Delete(':id') @HttpCode(200) @Permissions('tariffs:manage') deactivate(@Param('id') id: string) {
    return this.service.updateTariff(parseUuid(id), { status: 'INACTIVE' });
  }
  @Post(':id/reactivate') @Permissions('tariffs:manage') reactivate(@Param('id') id: string) {
    return this.service.updateTariff(parseUuid(id), { status: 'ACTIVE' });
  }
}
