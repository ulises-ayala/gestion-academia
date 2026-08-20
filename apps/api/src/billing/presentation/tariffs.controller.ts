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

@Controller('tariffs')
export class TariffsController {
  constructor(@Inject(BillingService) private readonly service: BillingService) {}
  @Get() list(@Query('status') status?: string) {
    return this.service.listTariffs(parseStatus(status));
  }
  @Get('active') listActive() {
    return this.service.listTariffs('ACTIVE');
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.service.getTariff(parseUuid(id));
  }
  @Post() create(@Body() input: CreateTariffDto) {
    return this.service.createTariff(input);
  }
  @Patch(':id') update(@Param('id') id: string, @Body() input: UpdateTariffDto) {
    return this.service.updateTariff(parseUuid(id), input);
  }
  @Delete(':id') @HttpCode(200) deactivate(@Param('id') id: string) {
    return this.service.updateTariff(parseUuid(id), { status: 'INACTIVE' });
  }
  @Post(':id/reactivate') reactivate(@Param('id') id: string) {
    return this.service.updateTariff(parseUuid(id), { status: 'ACTIVE' });
  }
}
