import type { CreateMonthlyChargeDto } from '@academy/contracts';
import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { parseUuid } from '../../shared/presentation/request-validation';
import { BillingService } from '../application/billing.service';
import { parsePeriod } from '../domain/billing';

@Controller('monthly-charges')
export class MonthlyChargesController {
  constructor(@Inject(BillingService) private readonly service: BillingService) {}
  @Get() list(@Query('studentId') studentId?: string, @Query('period') period?: string) {
    return this.service.listCharges({
      ...(studentId ? { studentId: parseUuid(studentId, 'studentId') } : {}),
      ...(period ? { period: parsePeriod(period) } : {}),
    });
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.service.getCharge(parseUuid(id));
  }
  @Post() create(@Body() input: CreateMonthlyChargeDto) {
    return this.service.createCharge({
      ...input,
      enrollmentId: parseUuid(input.enrollmentId, 'enrollmentId'),
      tariffId: parseUuid(input.tariffId, 'tariffId'),
    });
  }
}
