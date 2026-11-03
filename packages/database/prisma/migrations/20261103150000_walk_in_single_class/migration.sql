-- Alumno eventual: una clase suelta se puede cobrar a alguien que no es alumno regular. El pago
-- guarda su nombre (y, si los da, teléfono y DNI) en lugar de una ficha de alumno; no genera
-- cuotas ni cuenta como alumno, pero suma a la recaudación y a la liquidación del profesor.
ALTER TABLE "payments" ALTER COLUMN "student_id" DROP NOT NULL;
ALTER TABLE "payments" ADD COLUMN "walk_in_name" VARCHAR(160);
ALTER TABLE "payments" ADD COLUMN "walk_in_phone" VARCHAR(80);
ALTER TABLE "payments" ADD COLUMN "walk_in_dni" VARCHAR(20);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_payer_check" CHECK (
    ("student_id" IS NOT NULL AND "walk_in_name" IS NULL AND "walk_in_phone" IS NULL AND "walk_in_dni" IS NULL)
    OR ("student_id" IS NULL AND "walk_in_name" IS NOT NULL AND "kind" = 'OTHER' AND "concept" = 'SINGLE_CLASS')
  );
