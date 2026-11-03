-- Usar el saldo a favor en otros cobros (PO, 03/11/2026: clases sueltas, talleres, indumentaria,
-- Gala…). El otro cobro se paga en parte o del todo con el saldo de pagos de cuotas del alumno: cada
-- fila dice de qué pago sale el saldo y a qué cobro va. No mueve la caja (el dinero ya entró).
-- Si el cobro que lo usó se anula, el saldo vuelve. Append-only.
CREATE TABLE "payment_credit_uses" (
    "id" UUID NOT NULL,
    "source_payment_id" UUID NOT NULL,
    "target_payment_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_credit_uses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_credit_uses_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "payment_credit_uses_distinct_payments" CHECK ("source_payment_id" <> "target_payment_id")
);

CREATE UNIQUE INDEX "payment_credit_uses_source_target_key"
  ON "payment_credit_uses"("source_payment_id", "target_payment_id");
CREATE INDEX "payment_credit_uses_target_payment_id_idx" ON "payment_credit_uses"("target_payment_id");

ALTER TABLE "payment_credit_uses"
  ADD CONSTRAINT "payment_credit_uses_source_payment_id_fkey" FOREIGN KEY ("source_payment_id")
  REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_credit_uses"
  ADD CONSTRAINT "payment_credit_uses_target_payment_id_fkey" FOREIGN KEY ("target_payment_id")
  REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_credit_uses"
  ADD CONSTRAINT "payment_credit_uses_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id")
  REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
