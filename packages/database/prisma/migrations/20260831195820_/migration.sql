-- Align database defaults and generated index names with the Prisma schema.
ALTER TABLE "public"."enrollment_billing_conditions" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "public"."monthly_charge_adjustments" ALTER COLUMN "id" DROP DEFAULT;

ALTER INDEX "public"."enrollment_billing_conditions_enrollment_id_effective_from_effe"
  RENAME TO "enrollment_billing_conditions_enrollment_id_effective_from__idx";
ALTER INDEX "public"."monthly_charge_adjustments_monthly_charge_id_source_condition_i"
  RENAME TO "monthly_charge_adjustments_monthly_charge_id_source_conditi_key";
