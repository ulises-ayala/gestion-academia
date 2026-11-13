-- Potencial alumno que se inscribió: queda vinculado al alumno que se creó desde su ficha.
-- Un alumno viene de un solo potencial y un potencial se convierte una sola vez.
ALTER TABLE "leads" ADD COLUMN "student_id" UUID;

CREATE UNIQUE INDEX "leads_student_id_key" ON "leads"("student_id");

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_student_id_fkey" FOREIGN KEY ("student_id")
  REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
