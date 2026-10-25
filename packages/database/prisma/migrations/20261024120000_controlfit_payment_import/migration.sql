-- Historical ControlFit payments: provenance and idempotency, no backfill of existing rows.
CREATE TYPE "PaymentOrigin" AS ENUM ('CASH_DESK', 'CONTROLFIT_IMPORT');

ALTER TYPE "BillingAdjustmentType" ADD VALUE 'HISTORICAL_DISCOUNT';

ALTER TABLE "payments"
  ADD COLUMN "origin" "PaymentOrigin" NOT NULL DEFAULT 'CASH_DESK',
  ADD COLUMN "legacy_reference" VARCHAR(80);

CREATE UNIQUE INDEX "payments_legacy_reference_key" ON "payments"("legacy_reference");
