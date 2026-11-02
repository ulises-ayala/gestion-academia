import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SettlementsService } from './application/settlements.service';
import { SettlementsController } from './presentation/settlements.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [SettlementsController],
  providers: [SettlementsService],
})
export class SettlementsModule {}
