import type { CreateMonthlyChargeDto, GenerateMonthlyChargeDto } from '@academy/contracts';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { hasPermissions } from '../../auth/domain/permissions';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { ChargeGenerationService } from '../application/charge-generation.service';
import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { parseUuid } from '../../shared/presentation/request-validation';
import { BillingService } from '../application/billing.service';
import { parsePeriod } from '../domain/billing';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { DomainError } from '../../shared/domain/domain-error';

@Controller('monthly-charges')
export class MonthlyChargesController {
  constructor(
    @Inject(BillingService) private readonly service: BillingService,
    @Inject(ChargeGenerationService) private readonly generation: ChargeGenerationService,
  ) {}
  private actor(user: PublicAuthUser) {
    return { id: user.id, canBackfill: hasPermissions(user, ['charges:manage']) };
  }
  @Get('generation-preview') @Permissions('charges:generate') preview(
    @Query('enrollmentId') enrollmentId: string | undefined,
    @Query('period') period: string | undefined,
    @Query('untilPeriod') untilPeriod: string | undefined,
    @Query('dueDate') dueDate: string | undefined,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.generation.preview(
      {
        enrollmentId: parseUuid(enrollmentId ?? '', 'enrollmentId'),
        period: period ?? '',
        ...(untilPeriod ? { untilPeriod } : {}),
        ...(dueDate ? { dueDate } : {}),
      },
      this.actor(user),
    );
  }
  @Post('generate') @Permissions('charges:generate') generate(
    @Body() input: GenerateMonthlyChargeDto | null,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.generation.generate(
      {
        enrollmentId: parseUuid(input?.enrollmentId ?? '', 'enrollmentId'),
        period: input?.period ?? '',
        ...(input?.untilPeriod ? { untilPeriod: input.untilPeriod } : {}),
        ...(input?.dueDate ? { dueDate: input.dueDate } : {}),
      },
      this.actor(user),
    );
  }
  @Get() @Permissions('charges:read') list(
    @Query('studentId') studentId?: string,
    @Query('period') period?: string,
    @Query('status') status?: string,
  ) {
    if (
      status &&
      status !== 'PENDING' &&
      status !== 'PARTIAL' &&
      status !== 'PAID' &&
      status !== 'VOID'
    )
      throw new DomainError('VALIDATION_ERROR', 'Estado de cuota inválido', { field: 'status' });
    return this.service.listCharges({
      ...(studentId ? { studentId: parseUuid(studentId, 'studentId') } : {}),
      ...(period ? { period: parsePeriod(period) } : {}),
      ...(status ? { status: status as 'PENDING' | 'PARTIAL' | 'PAID' | 'VOID' } : {}),
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
