CREATE TYPE "BillingAdjustmentType" AS ENUM ('DIRECTION_SCHOLARSHIP', 'TEACHER_SCHOLARSHIP', 'TEACHER_DISCOUNT', 'LATE_FEE', 'REVERSAL');
CREATE TYPE "BillingCalculation" AS ENUM ('PERCENTAGE', 'FIXED');

CREATE TABLE "enrollment_billing_conditions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "enrollment_id" UUID NOT NULL,
  "type" "BillingAdjustmentType" NOT NULL, "calculation" "BillingCalculation" NOT NULL,
  "configured_value" DECIMAL(12,2) NOT NULL, "effective_from" DATE NOT NULL,
  "effective_until" DATE, "teacher_id" UUID, "authorized_by_user_id" UUID,
  "created_by_user_id" UUID NOT NULL, "ended_by_user_id" UUID, "ended_at" TIMESTAMPTZ(3),
  "reason" VARCHAR(500) NOT NULL, "end_reason" VARCHAR(500), "renewed_from_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "enrollment_billing_conditions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_condition_valid_range" CHECK ("effective_until" IS NULL OR "effective_until" >= "effective_from"),
  CONSTRAINT "billing_condition_supported_type" CHECK ("type" IN ('DIRECTION_SCHOLARSHIP','TEACHER_SCHOLARSHIP','TEACHER_DISCOUNT')),
  CONSTRAINT "billing_condition_value" CHECK ("configured_value" > 0 AND ("calculation" <> 'PERCENTAGE' OR "configured_value" <= 100))
);

CREATE TABLE "monthly_charge_adjustments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "monthly_charge_id" UUID NOT NULL,
  "source_condition_id" UUID, "type" "BillingAdjustmentType" NOT NULL,
  "calculation" "BillingCalculation", "configured_value" DECIMAL(12,2),
  "effective_amount" DECIMAL(12,2) NOT NULL, "student_amount_delta" DECIMAL(12,2) NOT NULL,
  "settlement_base_delta" DECIMAL(12,2) NOT NULL, "teacher_id" UUID,
  "authorized_by_user_id" UUID, "created_by_user_id" UUID, "reason" VARCHAR(500),
  "reversal_of_id" UUID, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monthly_charge_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "charge_adjustment_effective_amount" CHECK ("effective_amount" >= 0)
);

CREATE INDEX "enrollment_billing_conditions_enrollment_id_effective_from_effective_until_idx" ON "enrollment_billing_conditions"("enrollment_id", "effective_from", "effective_until");
CREATE INDEX "enrollment_billing_conditions_teacher_id_idx" ON "enrollment_billing_conditions"("teacher_id");
CREATE UNIQUE INDEX "monthly_charge_adjustments_monthly_charge_id_source_condition_id_key" ON "monthly_charge_adjustments"("monthly_charge_id", "source_condition_id");
CREATE UNIQUE INDEX "monthly_charge_adjustments_reversal_of_id_key" ON "monthly_charge_adjustments"("reversal_of_id");
CREATE UNIQUE INDEX "monthly_charge_adjustments_one_late_fee_per_charge" ON "monthly_charge_adjustments"("monthly_charge_id") WHERE "type" = 'LATE_FEE';
CREATE INDEX "monthly_charge_adjustments_monthly_charge_id_created_at_idx" ON "monthly_charge_adjustments"("monthly_charge_id", "created_at");
CREATE INDEX "monthly_charge_adjustments_teacher_id_idx" ON "monthly_charge_adjustments"("teacher_id");

ALTER TABLE "enrollment_billing_conditions" ADD CONSTRAINT "enrollment_billing_conditions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollment_billing_conditions" ADD CONSTRAINT "enrollment_billing_conditions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollment_billing_conditions" ADD CONSTRAINT "enrollment_billing_conditions_authorized_by_user_id_fkey" FOREIGN KEY ("authorized_by_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollment_billing_conditions" ADD CONSTRAINT "enrollment_billing_conditions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollment_billing_conditions" ADD CONSTRAINT "enrollment_billing_conditions_ended_by_user_id_fkey" FOREIGN KEY ("ended_by_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollment_billing_conditions" ADD CONSTRAINT "enrollment_billing_conditions_renewed_from_id_fkey" FOREIGN KEY ("renewed_from_id") REFERENCES "enrollment_billing_conditions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_charge_adjustments" ADD CONSTRAINT "monthly_charge_adjustments_monthly_charge_id_fkey" FOREIGN KEY ("monthly_charge_id") REFERENCES "monthly_charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_charge_adjustments" ADD CONSTRAINT "monthly_charge_adjustments_source_condition_id_fkey" FOREIGN KEY ("source_condition_id") REFERENCES "enrollment_billing_conditions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_charge_adjustments" ADD CONSTRAINT "monthly_charge_adjustments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_charge_adjustments" ADD CONSTRAINT "monthly_charge_adjustments_authorized_by_user_id_fkey" FOREIGN KEY ("authorized_by_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_charge_adjustments" ADD CONSTRAINT "monthly_charge_adjustments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_charge_adjustments" ADD CONSTRAINT "monthly_charge_adjustments_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "monthly_charge_adjustments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
