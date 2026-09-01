import { Module } from '@nestjs/common';
import { CashShiftsService } from './application/cash-shifts.service';
import { CashShiftsController } from './presentation/cash-shifts.controller';

@Module({ controllers: [CashShiftsController], providers: [CashShiftsService] })
export class CashModule {}
