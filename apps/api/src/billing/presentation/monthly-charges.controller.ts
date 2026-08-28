import type { CreateMonthlyChargeDto } from '@academy/contracts';
import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { parseUuid } from '../../shared/presentation/request-validation';
import { BillingService } from '../application/billing.service';
import { parsePeriod } from '../domain/billing';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { DomainError } from '../../shared/domain/domain-error';

@Controller('monthly-charges')
export class MonthlyChargesController {
  constructor(@Inject(BillingService) private readonly service: BillingService) {}
  @Get() @Permissions('charges:read') list(
    @Query('studentId') studentId?: string,
    @Query('period') period?: string,
    @Query('status') status?: string,
  ) {
    if (status && status !== 'PENDING' && status !== 'PAID' && status !== 'VOID')
      throw new DomainError('VALIDATION_ERROR', 'Estado de cuota inválido', { field: 'status' });
    return this.service.listCharges({
      ...(studentId ? { studentId: parseUuid(studentId, 'studentId') } : {}),
      ...(period ? { period: parsePeriod(period) } : {}),
      ...(status ? { status: status as 'PENDING' | 'PAID' | 'VOID' } : {}),
    });
  }
  @Get(':id') @Permissions('charges:read') get(@Param('id') id: string) {
    return this.service.getCharge(parseUuid(id));
  }
  @Post() @Permissions('charges:manage') create(@Body() input: CreateMonthlyChargeDto) {
    return this.service.createCharge({
      ...input,
      enrollmentId: parseUuid(input.enrollmentId, 'enrollmentId'),
      tariffId: parseUuid(input.tariffId, 'tariffId'),
    });
  }
}
