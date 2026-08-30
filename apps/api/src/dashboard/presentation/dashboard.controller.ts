import type { OperationalDashboardDto } from '@academy/contracts';
import { Controller, Get } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { OperationalDashboardService } from '../application/operational-dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: OperationalDashboardService) {}

  @Get('operational')
  getOperational(@CurrentUser() user: PublicAuthUser): Promise<OperationalDashboardDto> {
    return this.service.get(user, new Date());
  }
}
