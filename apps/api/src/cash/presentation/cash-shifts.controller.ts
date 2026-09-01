import type { CloseCashShiftDto, CreateCashCorrectionDto } from '@academy/contracts';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { hasPermissions } from '../../auth/domain/permissions';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { businessDayAt } from '../../dashboard/application/business-day';
import { DomainError } from '../../shared/domain/domain-error';
import { parsePage, parseUuid } from '../../shared/presentation/request-validation';
import { CashShiftsService } from '../application/cash-shifts.service';

@Controller('cash-shifts')
export class CashShiftsController {
  constructor(private readonly service: CashShiftsService) {}
  @Post('open') @Permissions('cash:manage') open(@CurrentUser() user: PublicAuthUser) {
    return this.service.open(user.id);
  }
  @Get('current') @Permissions('cash:manage') current(@CurrentUser() user: PublicAuthUser) {
    return this.service.current(user.id);
  }
  @Get('consolidated') @Permissions('cash:reconcile') consolidated(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const start = this.day(from).start;
    const end = this.day(to).end;
    return this.service.consolidated(start, end);
  }
  @Get() @Permissions('cash:manage') list(
    @CurrentUser() user: PublicAuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list(
      user.id,
      hasPermissions(user, ['cash:reconcile']),
      parsePage(page, 'page', 1, 1_000_000),
      parsePage(pageSize, 'pageSize', 20, 100),
    );
  }
  @Get(':id') @Permissions('cash:manage') get(
    @Param('id') id: string,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.get(parseUuid(id), user.id, hasPermissions(user, ['cash:reconcile']));
  }
  @Post(':id/close') @Permissions('cash:manage') close(
    @Param('id') id: string,
    @Body() body: CloseCashShiftDto,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.close(parseUuid(id), body, user.id);
  }
  @Post(':id/reconciliation-corrections') @Permissions('cash:reconcile') correct(
    @Param('id') id: string,
    @Body() body: CreateCashCorrectionDto,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.correct(parseUuid(id), body, user.id);
  }
  private day(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new DomainError('VALIDATION_ERROR', 'La fecha no es válida');
    const day = businessDayAt(
      new Date(`${value}T12:00:00.000Z`),
      process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires',
    );
    if (day.date !== value) throw new DomainError('VALIDATION_ERROR', 'La fecha no es válida');
    return day;
  }
}
