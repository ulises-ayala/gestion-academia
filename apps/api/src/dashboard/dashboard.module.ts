import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OperationalDashboardService } from './application/operational-dashboard.service';
import { DashboardController } from './presentation/dashboard.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardController],
  providers: [OperationalDashboardService],
})
export class DashboardModule {}
