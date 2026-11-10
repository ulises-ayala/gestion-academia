import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MonthlyBoardService } from './application/monthly-board.service';
import { OperationalDashboardService } from './application/operational-dashboard.service';
import { DashboardController } from './presentation/dashboard.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardController],
  providers: [OperationalDashboardService, MonthlyBoardService],
})
export class DashboardModule {}
