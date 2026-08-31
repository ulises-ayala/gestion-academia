ALTER TYPE "MonthlyChargeStatus" ADD VALUE 'PARTIAL' AFTER 'PENDING';

CREATE TABLE "payment_tenders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_tenders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_tenders_amount_positive" CHECK ("amount" > 0)
);

INSERT INTO "payment_tenders" ("payment_id", "method", "amount", "created_at")
SELECT "id", "payment_method", "amount", "created_at"
FROM "payments";

CREATE UNIQUE INDEX "payment_tenders_payment_id_method_key"
ON "payment_tenders"("payment_id", "method");
CREATE INDEX "payment_tenders_method_created_at_idx"
ON "payment_tenders"("method", "created_at");

ALTER TABLE "payment_tenders"
ADD CONSTRAINT "payment_tenders_payment_id_fkey"
FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "payments_payment_method_paid_at_idx";
ALTER TABLE "payments" DROP COLUMN "payment_method";
