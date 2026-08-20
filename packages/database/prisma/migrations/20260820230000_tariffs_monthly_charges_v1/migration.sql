CREATE TYPE "MonthlyChargeStatus" AS ENUM ('PENDING', 'PAID', 'VOID');

CREATE TABLE "tariffs" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "valid_from" DATE NOT NULL,
  "valid_to" DATE,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tariffs_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "tariffs_validity_check" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from")
);

CREATE TABLE "monthly_charges" (
  "id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "enrollment_id" UUID NOT NULL,
  "tariff_id" UUID NOT NULL,
  "period" DATE NOT NULL,
  "base_amount" DECIMAL(12, 2) NOT NULL,
  "discount_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "final_amount" DECIMAL(12, 2) NOT NULL,
  "due_date" DATE NOT NULL,
  "status" "MonthlyChargeStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "monthly_charges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monthly_charges_amounts_check" CHECK (
    "base_amount" >= 0 AND
    "discount_amount" >= 0 AND
    "final_amount" >= 0 AND
    "discount_amount" <= "base_amount" AND
    "final_amount" = "base_amount" - "discount_amount"
  ),
  CONSTRAINT "monthly_charges_period_check" CHECK (EXTRACT(DAY FROM "period") = 1),
  CONSTRAINT "monthly_charges_due_date_check" CHECK (
    "due_date" >= "period" AND "due_date" <= "period" + 9
  )
);

CREATE INDEX "tariffs_status_valid_from_valid_to_idx" ON "tariffs"("status", "valid_from", "valid_to");
CREATE INDEX "tariffs_name_idx" ON "tariffs"("name");
CREATE UNIQUE INDEX "monthly_charges_enrollment_id_period_key" ON "monthly_charges"("enrollment_id", "period");
CREATE INDEX "monthly_charges_student_id_period_status_idx" ON "monthly_charges"("student_id", "period", "status");
CREATE INDEX "monthly_charges_enrollment_id_period_status_idx" ON "monthly_charges"("enrollment_id", "period", "status");
CREATE INDEX "monthly_charges_period_status_idx" ON "monthly_charges"("period", "status");
CREATE INDEX "monthly_charges_tariff_id_idx" ON "monthly_charges"("tariff_id");

ALTER TABLE "monthly_charges" ADD CONSTRAINT "monthly_charges_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_charges" ADD CONSTRAINT "monthly_charges_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_charges" ADD CONSTRAINT "monthly_charges_tariff_id_fkey"
  FOREIGN KEY ("tariff_id") REFERENCES "tariffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
