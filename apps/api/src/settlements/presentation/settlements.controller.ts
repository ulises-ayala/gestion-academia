import type {
  CloseSettlementDto,
  ReopenSettlementDto,
  SaveClassSettlementPlanDto,
} from '@academy/contracts';
import { Body, Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { parseUuid } from '../../shared/presentation/request-validation';
import { SettlementsService } from '../application/settlements.service';

/**
 * Liquidación de profesores: Administración y Dirección (`settlements:manage`) la consultan y
 * configuran los repartos; solo Dirección (`settlements:approve`) cierra y reabre un mes.
 */
@Controller()
export class SettlementsController {
  constructor(private readonly service: SettlementsService) {}

  @Get('settlements/plans')
  @Permissions('settlements:manage')
  overview(@Query('period') period = '') {
    return this.service.overview(period);
  }

  @Get('settlements/:period')
  @Permissions('settlements:manage')
  get(@Param('period') period: string) {
    return this.service.get(period);
  }

  @Get('settlements/:period/export')
  @Permissions('settlements:manage')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="liquidacion-carmesi.csv"')
  export(@Param('period') period: string) {
    return this.service.exportCsv(period);
  }

  @Post('settlements/:period/close')
  @Permissions('settlements:approve')
  close(
    @Param('period') period: string,
    @Body() input: CloseSettlementDto,
    @CurrentUser() actor: PublicAuthUser,
  ) {
    return this.service.close(period, input?.note, actor);
  }

  @Post('settlements/:period/reopen')
  @Permissions('settlements:approve')
  reopen(
    @Param('period') period: string,
    @Body() input: ReopenSettlementDto,
    @CurrentUser() actor: PublicAuthUser,
  ) {
    return this.service.reopen(period, input?.reason, actor);
  }

  @Get('classes/:id/settlement-plans')
  @Permissions('settlements:manage')
  plans(@Param('id') id: string) {
    return this.service.plans(parseUuid(id));
  }

  @Post('classes/:id/settlement-plans')
  @Permissions('settlements:manage')
  savePlan(
    @Param('id') id: string,
    @Body() input: SaveClassSettlementPlanDto,
    @CurrentUser() actor: PublicAuthUser,
  ) {
    return this.service.savePlan(parseUuid(id), input, actor);
  }
}
