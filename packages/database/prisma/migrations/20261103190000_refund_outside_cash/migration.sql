-- Devoluciones que autoriza Dirección: solo el efectivo que sale de la caja es un egreso del
-- turno. Mercado Pago, transferencia, tarjeta o el efectivo que guarda Dirección quedan registrados
-- sin turno (fuera de la caja).
ALTER TABLE "payment_refunds" ALTER COLUMN "cash_shift_id" DROP NOT NULL;
ALTER TABLE "payment_refunds"
  ADD CONSTRAINT "payment_refunds_cash_shift_only_cash_check"
  CHECK ("cash_shift_id" IS NULL OR "method" = 'CASH') NOT VALID;
