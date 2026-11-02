-- Transferencia bancaria como medio de pago, distinta de Mercado Pago.
ALTER TYPE "PaymentMethod" ADD VALUE 'TRANSFER';

-- Conceptos fijos de los otros cobros, para la recaudación por concepto: indumentaria y
-- precintos de la Gala (además de clase suelta y "Otro" con detalle).
ALTER TYPE "OtherPaymentConcept" ADD VALUE 'APPAREL';
ALTER TYPE "OtherPaymentConcept" ADD VALUE 'GALA_SEAL';

-- Solo la clase suelta lleva clase y profesor; "Otro" exige detalle. Compara contra valores ya
-- existentes del enum (los nuevos no se pueden usar en la misma transacción).
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
      AND (
        ("concept" = 'SINGLE_CLASS' AND "class_id" IS NOT NULL AND "teacher_id" IS NOT NULL)
        OR ("concept" <> 'SINGLE_CLASS' AND "class_id" IS NULL AND "teacher_id" IS NULL)
      )
      AND (
        "concept" <> 'OTHER'
        OR ("concept_detail" IS NOT NULL AND length(btrim("concept_detail")) > 0)
      )
    )
  );
