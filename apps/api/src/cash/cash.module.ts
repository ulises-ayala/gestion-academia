import { Module } from '@nestjs/common';
import { CashHandoversService } from './application/cash-handovers.service';
import { CashShiftsService } from './application/cash-shifts.service';
import { CashHandoversController } from './presentation/cash-handovers.controller';
import { CashShiftsController } from './presentation/cash-shifts.controller';

@Module({
  controllers: [CashShiftsController, CashHandoversController],
  providers: [CashShiftsService, CashHandoversService],
})
export class CashModule {}
