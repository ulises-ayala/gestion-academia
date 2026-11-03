-- Saldo a favor: la parte de un pago de cuotas que no está imputada a ninguna cuota (se cobró de
-- más o se desimputó un pago duplicado). No se aplica solo: Administración lo imputa a una cuota
-- (reimputación, sin caja) o lo devuelve. Cada devolución es un egreso REFUND en el turno de caja
-- abierto de quien devuelve, con el medio elegido. Append-only: no se edita ni se borra.
CREATE TABLE "payment_refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "cash_shift_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_refunds_positive_amount_check" CHECK ("amount" > 0)
);

CREATE INDEX "payment_refunds_payment_id_idx" ON "payment_refunds"("payment_id");
CREATE INDEX "payment_refunds_created_at_idx" ON "payment_refunds"("created_at");

ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_cash_shift_id_fkey" FOREIGN KEY ("cash_shift_id") REFERENCES "cash_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- El movimiento de una devolución apunta al pago y a la devolución, no a un medio del pago (se
-- puede devolver por otro medio).
ALTER TABLE "cash_movements" ALTER COLUMN "source_payment_tender_id" DROP NOT NULL;
ALTER TABLE "cash_movements" ADD COLUMN "refund_id" UUID;
CREATE UNIQUE INDEX "cash_movements_refund_id_key" ON "cash_movements"("refund_id");
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "payment_refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_reversal_link_check";
ALTER TABLE "cash_movements"
  ADD CONSTRAINT "cash_movements_reversal_link_check" CHECK (
    ("type" = 'COLLECTION' AND "reversal_of_id" IS NULL AND "refund_id" IS NULL AND "source_payment_tender_id" IS NOT NULL)
    OR ("type" = 'REVERSAL' AND "reversal_of_id" IS NOT NULL AND "refund_id" IS NULL AND "source_payment_tender_id" IS NOT NULL)
    OR ("type" = 'REFUND' AND "reversal_of_id" IS NULL AND "refund_id" IS NOT NULL)
  );
