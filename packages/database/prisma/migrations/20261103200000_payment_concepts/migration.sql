-- Conceptos de ingreso configurables (PO, 03/11/2026): los otros cobros que no son clase suelta ni
-- recargo por tarjeta se eligen de un catálogo que Administración y Dirección pueden ampliar.
CREATE TABLE "payment_concepts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "normalized_name" VARCHAR(80) NOT NULL,
    "requires_detail" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_concepts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_concepts_name_not_blank" CHECK (length(btrim("name")) > 0)
);

CREATE UNIQUE INDEX "payment_concepts_normalized_name_key" ON "payment_concepts"("normalized_name");

-- Los conceptos que nombró la PO. "Otros" exige contar qué se cobró.
INSERT INTO "payment_concepts" ("name", "normalized_name", "requires_detail", "sort_order") VALUES
  ('Formaciones docentes', 'formaciones docentes', false, 10),
  ('Inscripciones', 'inscripciones', false, 20),
  ('Workshops y talleres', 'workshops y talleres', false, 30),
  ('Indumentaria', 'indumentaria', false, 40),
  ('Entradas o precintos de la Gala', 'entradas o precintos de la gala', false, 50),
  ('Otros', 'otros', true, 1000);

ALTER TABLE "payments" ADD COLUMN "concept_id" UUID;
CREATE INDEX "payments_concept_id_idx" ON "payments"("concept_id");
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_concept_id_fkey" FOREIGN KEY ("concept_id")
  REFERENCES "payment_concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Los cobros ya registrados pasan al catálogo: Indumentaria, Gala y "Otro" (con su detalle).
UPDATE "payments" SET "concept" = 'OTHER',
  "concept_id" = (SELECT "id" FROM "payment_concepts" WHERE "normalized_name" = 'indumentaria')
WHERE "concept" = 'APPAREL';
UPDATE "payments" SET "concept" = 'OTHER',
  "concept_id" = (SELECT "id" FROM "payment_concepts" WHERE "normalized_name" = 'entradas o precintos de la gala')
WHERE "concept" = 'GALA_SEAL';
UPDATE "payments"
SET "concept_id" = (SELECT "id" FROM "payment_concepts" WHERE "normalized_name" = 'otros')
WHERE "concept" = 'OTHER' AND "concept_id" IS NULL;

-- "OTHER" es ahora un concepto del catálogo (obligatorio); clase suelta y recargo no llevan uno.
-- El detalle obligatorio depende del concepto ("Otros") y lo valida la aplicación.
ALTER TABLE "payments" DROP CONSTRAINT "payments_other_concept_check";
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_other_concept_check" CHECK (
    (
      "kind" = 'CHARGES'
      AND "concept" IS NULL AND "concept_detail" IS NULL AND "concept_id" IS NULL
      AND "class_id" IS NULL AND "teacher_id" IS NULL
    )
    OR (
      "kind" = 'OTHER'
      AND "concept" IS NOT NULL
      AND (
        ("concept" = 'SINGLE_CLASS' AND "class_id" IS NOT NULL AND "teacher_id" IS NOT NULL)
        OR ("concept" <> 'SINGLE_CLASS' AND "class_id" IS NULL AND "teacher_id" IS NULL)
      )
      AND (("concept" = 'OTHER') = ("concept_id" IS NOT NULL))
      AND "concept" NOT IN ('APPAREL', 'GALA_SEAL')
    )
  );
