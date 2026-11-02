-- Una clase puede tener profesores además del responsable (p. ej. Formación Docente). El
-- responsable sigue en "classes"."teacher_id": recibe las cuotas en los reportes y define el
-- control de superposición horaria.
CREATE TABLE "class_additional_teachers" (
    "class_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_additional_teachers_pkey" PRIMARY KEY ("class_id","teacher_id")
);

CREATE INDEX "class_additional_teachers_teacher_id_idx" ON "class_additional_teachers"("teacher_id");

ALTER TABLE "class_additional_teachers" ADD CONSTRAINT "class_additional_teachers_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_additional_teachers" ADD CONSTRAINT "class_additional_teachers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
