import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ReportsService } from './application/reports.service';
import { ReportsController } from './presentation/reports.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
