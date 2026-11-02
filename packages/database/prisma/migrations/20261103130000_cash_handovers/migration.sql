-- Entrega del efectivo recaudado a Dirección (semanal). No es un gasto ni un movimiento de un
-- turno: registra qué período de recaudación cubre, cuánto se entregó y cuánto efectivo se había
-- cobrado en ese período al registrarla. Se anula con motivo; nunca se borra.
CREATE TABLE "cash_handovers" (
    "id" UUID NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "collected_amount" DECIMAL(12,2) NOT NULL,
    "received_by" VARCHAR(120) NOT NULL,
    "note" VARCHAR(500),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_user_id" UUID,
    "void_reason" VARCHAR(500),

    CONSTRAINT "cash_handovers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_handovers_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "cash_handovers_collected_not_negative" CHECK ("collected_amount" >= 0),
    CONSTRAINT "cash_handovers_range_valid" CHECK ("to_date" >= "from_date"),
    CONSTRAINT "cash_handovers_void_complete" CHECK (
      ("voided_at" IS NULL AND "voided_by_user_id" IS NULL AND "void_reason" IS NULL)
      OR ("voided_at" IS NOT NULL AND "voided_by_user_id" IS NOT NULL AND "void_reason" IS NOT NULL)
    )
);

CREATE INDEX "cash_handovers_to_date_idx" ON "cash_handovers"("to_date");

ALTER TABLE "cash_handovers"
  ADD CONSTRAINT "cash_handovers_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id")
  REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_handovers"
  ADD CONSTRAINT "cash_handovers_voided_by_user_id_fkey" FOREIGN KEY ("voided_by_user_id")
  REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
