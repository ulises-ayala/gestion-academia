-- Deuda histórica: deuda anterior al sistema (por ejemplo, la que no trajo la importación de
-- ControlFit) cargada como un monto único con detalle. Se cobra como una cuota más, admite
-- pagos parciales y no lleva tarifa ni recargo.
CREATE TYPE "MonthlyChargeKind" AS ENUM ('MONTHLY', 'HISTORICAL_DEBT');

ALTER TABLE "monthly_charges"
  ADD COLUMN "kind" "MonthlyChargeKind" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "description" VARCHAR(200),
  ALTER COLUMN "tariff_id" DROP NOT NULL;

-- Cuota mensual: con tarifa y sin detalle. Deuda histórica: sin tarifa y con detalle.
ALTER TABLE "monthly_charges" ADD CONSTRAINT "monthly_charges_kind_check" CHECK (
  ("kind" = 'MONTHLY' AND "tariff_id" IS NOT NULL AND "description" IS NULL)
  OR (
    "kind" = 'HISTORICAL_DEBT' AND "tariff_id" IS NULL
    AND "description" IS NOT NULL AND length(btrim("description")) > 0
  )
);

-- Una cuota por inscripción y mes sigue valiendo para las mensuales; la deuda histórica
-- puede compartir el mes con una cuota mensual.
DROP INDEX "monthly_charges_enrollment_id_period_key";
CREATE UNIQUE INDEX "monthly_charges_enrollment_id_period_key"
  ON "monthly_charges"("enrollment_id", "period")
  WHERE "kind" = 'MONTHLY';
