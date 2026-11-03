import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ClosingsService } from './application/closings.service';
import { ReportsService } from './application/reports.service';
import { ClosingsController } from './presentation/closings.controller';
import { ReportsController } from './presentation/reports.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [ReportsController, ClosingsController],
  providers: [ReportsService, ClosingsService],
})
export class ReportsModule {}
