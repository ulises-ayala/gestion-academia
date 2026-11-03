-- El recargo por tarjeta queda ligado al cobro de cuotas con el que se cobró: anular ese cobro
-- anula también su recargo, corregirlo pasa el vínculo al reemplazo y el recibo lo muestra.
-- Los recargos ya cargados quedan sin vínculo (se anulan aparte, como hasta ahora).
ALTER TABLE "payments" ADD COLUMN "surcharge_of_id" UUID;

CREATE UNIQUE INDEX "payments_surcharge_of_id_key" ON "payments"("surcharge_of_id");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_surcharge_of_id_fkey" FOREIGN KEY ("surcharge_of_id")
  REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_surcharge_of_check" CHECK (
    "surcharge_of_id" IS NULL OR "concept" = 'CARD_SURCHARGE'
  );