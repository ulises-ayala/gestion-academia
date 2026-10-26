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
import { ReceivablesService } from './application/receivables.service';
import { BillingAdjustmentsService } from './application/billing-adjustments.service';
import { BillingAdjustmentsController } from './presentation/billing-adjustments.controller';
import { CHARGE_GENERATION_REPOSITORY } from './application/charge-generation.repository';
import { ChargeGenerationService } from './application/charge-generation.service';
import { PrismaChargeGenerationRepository } from './infrastructure/prisma-charge-generation.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [
    TariffsController,
    MonthlyChargesController,
    PaymentsController,
    BillingAdjustmentsController,
  ],
  providers: [
    BillingService,
    PaymentsService,
    ReceivablesService,
    BillingAdjustmentsService,
    ChargeGenerationService,
    { provide: CHARGE_GENERATION_REPOSITORY, useClass: PrismaChargeGenerationRepository },
    { provide: BILLING_REPOSITORY, useClass: PrismaBillingRepository },
    { provide: PAYMENTS_REPOSITORY, useClass: PrismaPaymentsRepository },
  ],
})
export class BillingModule {}
