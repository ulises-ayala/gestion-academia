-- Liquidación de profesores (decisiones 227 a 231): cada clase reparte lo cobrado entre sus
-- profesores con porcentajes que rigen desde un mes; lo que no se reparte queda para la
-- academia. Dirección cierra cada mes y la liquidación queda guardada tal como se cerró.
CREATE TABLE "class_settlement_plans" (
    "id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "valid_from" DATE NOT NULL,
    "reason" VARCHAR(500),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "class_settlement_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "class_settlement_plans_valid_from_first_day" CHECK (EXTRACT(DAY FROM "valid_from") = 1)
);

CREATE TABLE "class_settlement_shares" (
    "plan_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "class_settlement_shares_pkey" PRIMARY KEY ("plan_id","teacher_id"),
    CONSTRAINT "class_settlement_shares_percentage_range" CHECK ("percentage" > 0 AND "percentage" <= 100)
);

CREATE TABLE "settlement_closings" (
    "id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" VARCHAR(500),
    "closed_by_user_id" UUID NOT NULL,
    "closed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_closings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "settlement_closings_period_first_day" CHECK (EXTRACT(DAY FROM "period") = 1)
);

CREATE UNIQUE INDEX "class_settlement_plans_class_id_valid_from_key" ON "class_settlement_plans"("class_id", "valid_from");

CREATE INDEX "class_settlement_shares_teacher_id_idx" ON "class_settlement_shares"("teacher_id");

CREATE UNIQUE INDEX "settlement_closings_period_key" ON "settlement_closings"("period");

ALTER TABLE "class_settlement_plans" ADD CONSTRAINT "class_settlement_plans_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_settlement_plans" ADD CONSTRAINT "class_settlement_plans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_settlement_shares" ADD CONSTRAINT "class_settlement_shares_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "class_settlement_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_settlement_shares" ADD CONSTRAINT "class_settlement_shares_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "settlement_closings" ADD CONSTRAINT "settlement_closings_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
