import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { BILLING_REPOSITORY } from './application/billing.repository';
import { BillingService } from './application/billing.service';
import { PrismaBillingRepository } from './infrastructure/prisma-billing.repository';
import { MonthlyChargesController } from './presentation/monthly-charges.controller';
import { TariffsController } from './presentation/tariffs.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [TariffsController, MonthlyChargesController],
  providers: [BillingService, { provide: BILLING_REPOSITORY, useClass: PrismaBillingRepository }],
})
export class BillingModule {}
