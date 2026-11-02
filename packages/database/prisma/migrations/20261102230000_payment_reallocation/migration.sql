-- Reimputar un pago: cambiar las cuotas a las que se aplicó sin tocar el pago ni la caja.
-- Append-only: la imputación original no se modifica; la reimputación agrega filas negativas en
-- las cuotas que pierden y positivas en las que ganan, así las sumas por cuota quedan correctas.
CREATE TABLE "payment_reallocations" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reallocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_reallocations_payment_id_idx" ON "payment_reallocations"("payment_id");

ALTER TABLE "payment_reallocations"
  ADD CONSTRAINT "payment_reallocations_payment_id_fkey" FOREIGN KEY ("payment_id")
  REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_reallocations"
  ADD CONSTRAINT "payment_reallocations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id")
  REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_allocations" ADD COLUMN "reallocation_id" UUID;

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_reallocation_id_fkey" FOREIGN KEY ("reallocation_id")
  REFERENCES "payment_reallocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una imputación original por pago y cuota; cada reimputación, una fila por cuota.
DROP INDEX "payment_allocations_payment_id_monthly_charge_id_key";
CREATE UNIQUE INDEX "payment_allocations_original_payment_charge_key"
  ON "payment_allocations"("payment_id", "monthly_charge_id") WHERE "reallocation_id" IS NULL;
CREATE UNIQUE INDEX "payment_allocations_reallocation_id_monthly_charge_id_key"
  ON "payment_allocations"("reallocation_id", "monthly_charge_id");
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");

-- Solo una reimputación puede restar.
ALTER TABLE "payment_allocations" DROP CONSTRAINT "payment_allocations_amount_positive";
ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_amount_valid"
  CHECK ("amount" > 0 OR ("amount" < 0 AND "reallocation_id" IS NOT NULL));
