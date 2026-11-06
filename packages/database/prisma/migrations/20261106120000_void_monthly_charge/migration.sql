-- Anular una cuota generada por error (decisión 258): la cuota anulada queda guardada (VOID) y
-- no ocupa su mes, así se puede volver a generar la que corresponde. No cambia datos.
DROP INDEX "monthly_charges_enrollment_id_period_key";
CREATE UNIQUE INDEX "monthly_charges_enrollment_id_period_key"
  ON "monthly_charges"("enrollment_id", "period")
  WHERE "kind" = 'MONTHLY' AND "status" <> 'VOID';
