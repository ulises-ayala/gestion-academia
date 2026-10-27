-- Cobros que no son cuotas: clase suelta u otro concepto. No se imputan a cuotas
-- pero entran a la caja igual que cualquier cobro. Las filas existentes quedan como CHARGES.
CREATE TYPE "PaymentKind" AS ENUM ('CHARGES', 'OTHER');
CREATE TYPE "OtherPaymentConcept" AS ENUM ('SINGLE_CLASS', 'OTHER');

ALTER TABLE "payments"
  ADD COLUMN "kind" "PaymentKind" NOT NULL DEFAULT 'CHARGES',
  ADD COLUMN "concept" "OtherPaymentConcept",
  ADD COLUMN "concept_detail" VARCHAR(200),
  ADD COLUMN "class_id" UUID;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "payments_kind_paid_at_idx" ON "payments"("kind", "paid_at");

-- Un cobro de cuotas no lleva concepto; uno OTHER lo exige. La clase suelta necesita la clase
-- y "Otro" necesita el detalle.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_other_concept_check" CHECK (
    ("kind" = 'CHARGES' AND "concept" IS NULL AND "concept_detail" IS NULL AND "class_id" IS NULL)
    OR (
      "kind" = 'OTHER'
      AND "concept" IS NOT NULL
      AND ("concept" <> 'SINGLE_CLASS' OR "class_id" IS NOT NULL)
      AND ("concept" <> 'OTHER' OR ("concept_detail" IS NOT NULL AND length(btrim("concept_detail")) > 0))
    )
  );
