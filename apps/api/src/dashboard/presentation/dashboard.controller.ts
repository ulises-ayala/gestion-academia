import type { MonthlyBoardDto, OperationalDashboardDto } from '@academy/contracts';
import { Controller, Get, Query } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { MonthlyBoardService } from '../application/monthly-board.service';
import { OperationalDashboardService } from '../application/operational-dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly service: OperationalDashboardService,
    private readonly board: MonthlyBoardService,
  ) {}

  @Get('operational')
  getOperational(@CurrentUser() user: PublicAuthUser): Promise<OperationalDashboardDto> {
    return this.service.get(user, new Date());
  }

  /** Tablero mensual: lo ve quien gestiona alumnos; los importes, solo con reports:operational. */
  @Get('monthly')
  @Permissions('students:manage')
  getMonthly(
    @CurrentUser() user: PublicAuthUser,
    @Query('month') month?: string,
  ): Promise<MonthlyBoardDto> {
    return this.board.get(user, month, new Date());
  }
}
