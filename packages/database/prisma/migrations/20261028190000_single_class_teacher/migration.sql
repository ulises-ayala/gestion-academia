-- La clase suelta guarda el profesor que la dictó al momento del cobro, para que ingresos y
-- liquidaciones no cambien si después se edita la clase o se registra un reemplazo.
ALTER TABLE "payments" ADD COLUMN "teacher_id" UUID;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "payments_teacher_id_paid_at_idx" ON "payments"("teacher_id", "paid_at");

-- Clases sueltas ya registradas: se completan con el profesor actual de su clase.
UPDATE "payments" p
SET "teacher_id" = c."teacher_id"
FROM "classes" c
WHERE p."class_id" = c."id" AND p."concept" = 'SINGLE_CLASS' AND p."teacher_id" IS NULL;

-- La clase suelta exige clase y profesor; los demás cobros no llevan ninguno de los dos.
ALTER TABLE "payments" DROP CONSTRAINT "payments_other_concept_check";
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_other_concept_check" CHECK (
    (
      "kind" = 'CHARGES'
      AND "concept" IS NULL AND "concept_detail" IS NULL
      AND "class_id" IS NULL AND "teacher_id" IS NULL
    )
    OR (
      "kind" = 'OTHER'
      AND "concept" IS NOT NULL
      AND ("concept" <> 'SINGLE_CLASS' OR ("class_id" IS NOT NULL AND "teacher_id" IS NOT NULL))
      AND (
        "concept" <> 'OTHER'
        OR (
          "concept_detail" IS NOT NULL AND length(btrim("concept_detail")) > 0
          AND "class_id" IS NULL AND "teacher_id" IS NULL
        )
      )
    )
  );
