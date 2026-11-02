-- La inscripción guarda las condiciones de cobro del alumno: la modalidad (tarifa que paga, p. ej.
-- $40.000 o $25.000 en la misma clase) y el día de pago acordado. Valen para las cuotas que se
-- generen después; las ya generadas conservan su importe y vencimiento.
ALTER TABLE "enrollments" ADD COLUMN "tariff_id" UUID;
ALTER TABLE "enrollments" ADD COLUMN "payment_due_day" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_payment_due_day_check" CHECK ("payment_due_day" BETWEEN 1 AND 31);

CREATE INDEX "enrollments_tariff_id_idx" ON "enrollments"("tariff_id");

ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "tariffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- El vencimiento puede caer cualquier día del mes de la cuota (antes, del 1 al 10).
ALTER TABLE "monthly_charges" DROP CONSTRAINT "monthly_charges_due_date_check";
ALTER TABLE "monthly_charges"
  ADD CONSTRAINT "monthly_charges_due_date_check" CHECK (
    "due_date" >= "period" AND "due_date" < ("period" + INTERVAL '1 month')::date
  );
