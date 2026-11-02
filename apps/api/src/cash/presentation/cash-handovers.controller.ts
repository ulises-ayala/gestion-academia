import type { CreateCashHandoverDto, VoidPaymentDto } from '@academy/contracts';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { parsePage, parseUuid } from '../../shared/presentation/request-validation';
import { CashHandoversService } from '../application/cash-handovers.service';

/** Entregas del efectivo recaudado a Dirección (Administración y Dirección). */
@Controller('cash-handovers')
export class CashHandoversController {
  constructor(private readonly service: CashHandoversService) {}

  @Get() @Permissions('cash:reconcile') list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list(
      parsePage(page, 'page', 1, 1_000_000),
      parsePage(pageSize, 'pageSize', 10, 100),
    );
  }

  /** Efectivo cobrado en el período, para precargar la entrega. */
  @Get('cash-collected') @Permissions('cash:reconcile') cashCollected(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.cashCollected(from, to);
  }

  @Post() @Permissions('cash:reconcile') create(
    @Body() body: CreateCashHandoverDto | null,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.create(body, user.id);
  }

  @Post(':id/void') @Permissions('cash:reconcile') void(
    @Param('id') id: string,
    @Body() body: VoidPaymentDto | null,
    @CurrentUser() user: PublicAuthUser,
  ) {
    return this.service.void(parseUuid(id), body?.reason, user.id);
  }
}
