-- CreateEnum
CREATE TYPE "public"."CashShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."CashMovementType" AS ENUM ('COLLECTION', 'REVERSAL');

-- CreateTable
CREATE TABLE "public"."cash_shifts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "public"."CashShiftStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(3),
    "closed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "cash_shifts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_shifts_closed_fields_check" CHECK (
      ("status" = 'OPEN' AND "closed_at" IS NULL AND "closed_by_user_id" IS NULL)
      OR ("status" = 'CLOSED' AND "closed_at" IS NOT NULL AND "closed_by_user_id" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "public"."cash_movements" (
    "id" UUID NOT NULL,
    "cash_shift_id" UUID NOT NULL,
    "type" "public"."CashMovementType" NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "source_payment_id" UUID NOT NULL,
    "source_payment_tender_id" UUID NOT NULL,
    "reversal_of_id" UUID,
    "actor_user_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_movements_positive_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "cash_movements_reversal_link_check" CHECK (
      ("type" = 'COLLECTION' AND "reversal_of_id" IS NULL)
      OR ("type" = 'REVERSAL' AND "reversal_of_id" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "public"."cash_shift_closing_lines" (
    "id" UUID NOT NULL,
    "cash_shift_id" UUID NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "expected_amount" DECIMAL(12,2) NOT NULL,
    "declared_amount" DECIMAL(12,2) NOT NULL,
    "difference_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_shift_closing_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_shift_closing_lines_amounts_check" CHECK ("expected_amount" >= 0 AND "declared_amount" >= 0)
);

-- CreateTable
CREATE TABLE "public"."cash_reconciliation_corrections" (
    "id" UUID NOT NULL,
    "cash_shift_id" UUID NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "amount_delta" DECIMAL(12,2) NOT NULL,
    "original_declared_amount" DECIMAL(12,2) NOT NULL,
    "corrected_declared_amount" DECIMAL(12,2) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_reconciliation_corrections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_reconciliation_corrections_amounts_check" CHECK ("original_declared_amount" >= 0 AND "corrected_declared_amount" >= 0),
    CONSTRAINT "cash_reconciliation_corrections_reason_check" CHECK (length(trim("reason")) > 0)
);

CREATE INDEX "cash_shifts_user_id_opened_at_idx" ON "public"."cash_shifts"("user_id", "opened_at" DESC);
CREATE INDEX "cash_shifts_status_opened_at_idx" ON "public"."cash_shifts"("status", "opened_at" DESC);
CREATE UNIQUE INDEX "cash_shifts_one_open_per_user_key" ON "public"."cash_shifts"("user_id") WHERE "status" = 'OPEN';
CREATE UNIQUE INDEX "cash_movements_reversal_of_id_key" ON "public"."cash_movements"("reversal_of_id");
CREATE UNIQUE INDEX "cash_movements_collection_tender_key" ON "public"."cash_movements"("source_payment_tender_id") WHERE "type" = 'COLLECTION';
CREATE INDEX "cash_movements_cash_shift_id_created_at_idx" ON "public"."cash_movements"("cash_shift_id", "created_at");
CREATE INDEX "cash_movements_source_payment_id_idx" ON "public"."cash_movements"("source_payment_id");
CREATE INDEX "cash_movements_source_payment_tender_id_idx" ON "public"."cash_movements"("source_payment_tender_id");
CREATE UNIQUE INDEX "cash_shift_closing_lines_cash_shift_id_method_key" ON "public"."cash_shift_closing_lines"("cash_shift_id", "method");
CREATE INDEX "cash_reconciliation_corrections_cash_shift_id_method_create_idx" ON "public"."cash_reconciliation_corrections"("cash_shift_id", "method", "created_at");

ALTER TABLE "public"."cash_shifts" ADD CONSTRAINT "cash_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."cash_shifts" ADD CONSTRAINT "cash_shifts_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."cash_movements" ADD CONSTRAINT "cash_movements_cash_shift_id_fkey" FOREIGN KEY ("cash_shift_id") REFERENCES "public"."cash_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."cash_movements" ADD CONSTRAINT "cash_movements_source_payment_id_fkey" FOREIGN KEY ("source_payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."cash_movements" ADD CONSTRAINT "cash_movements_source_payment_tender_id_fkey" FOREIGN KEY ("source_payment_tender_id") REFERENCES "public"."payment_tenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."cash_movements" ADD CONSTRAINT "cash_movements_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."cash_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."cash_movements" ADD CONSTRAINT "cash_movements_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."cash_shift_closing_lines" ADD CONSTRAINT "cash_shift_closing_lines_cash_shift_id_fkey" FOREIGN KEY ("cash_shift_id") REFERENCES "public"."cash_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."cash_reconciliation_corrections" ADD CONSTRAINT "cash_reconciliation_corrections_cash_shift_id_fkey" FOREIGN KEY ("cash_shift_id") REFERENCES "public"."cash_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."cash_reconciliation_corrections" ADD CONSTRAINT "cash_reconciliation_corrections_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
