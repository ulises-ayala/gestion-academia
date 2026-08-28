import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { BILLING_REPOSITORY } from './application/billing.repository';
import { BillingService } from './application/billing.service';
import { PrismaBillingRepository } from './infrastructure/prisma-billing.repository';
import { MonthlyChargesController } from './presentation/monthly-charges.controller';
import { TariffsController } from './presentation/tariffs.controller';
import { PAYMENTS_REPOSITORY } from './application/payments.repository';
import { PaymentsService } from './application/payments.service';
import { PrismaPaymentsRepository } from './infrastructure/prisma-payments.repository';
import { PaymentsController } from './presentation/payments.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [TariffsController, MonthlyChargesController, PaymentsController],
  providers: [
    BillingService,
    PaymentsService,
    { provide: BILLING_REPOSITORY, useClass: PrismaBillingRepository },
    { provide: PAYMENTS_REPOSITORY, useClass: PrismaPaymentsRepository },
  ],
})
export class BillingModule {}
