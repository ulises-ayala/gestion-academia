-- Clase de prueba gratis: un potencial alumno prueba cada clase una sola vez, sin deuda ni
-- inscripción. La unicidad (potencial alumno, clase) es el control de "una por clase".
CREATE TABLE "lead_trial_classes" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "trial_date" DATE NOT NULL,
    "notes" VARCHAR(500),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_trial_classes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_trial_classes_lead_id_class_id_key" ON "lead_trial_classes"("lead_id", "class_id");
CREATE INDEX "lead_trial_classes_class_id_trial_date_idx" ON "lead_trial_classes"("class_id", "trial_date");

ALTER TABLE "lead_trial_classes" ADD CONSTRAINT "lead_trial_classes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_trial_classes" ADD CONSTRAINT "lead_trial_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_trial_classes" ADD CONSTRAINT "lead_trial_classes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
