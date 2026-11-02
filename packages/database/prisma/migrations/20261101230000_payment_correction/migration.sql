-- Corregir un pago (medio, importe o fecha): el original queda anulado y el nuevo guarda a cuál
-- reemplaza. Un pago se corrige una sola vez; para volver a corregir se corrige el nuevo.
ALTER TABLE "payments" ADD COLUMN "correction_of_id" UUID;

CREATE UNIQUE INDEX "payments_correction_of_id_key" ON "payments"("correction_of_id");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_correction_of_id_fkey" FOREIGN KEY ("correction_of_id")
  REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
