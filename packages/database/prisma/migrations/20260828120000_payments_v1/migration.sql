CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MERCADO_PAGO', 'CARD');
CREATE TYPE "PaymentStatus" AS ENUM ('CONFIRMED', 'VOID');

CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "paid_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "monthly_charge_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_allocations_amount_positive" CHECK ("amount" > 0)
);

CREATE INDEX "payments_student_id_paid_at_idx" ON "payments"("student_id", "paid_at");
CREATE INDEX "payments_status_paid_at_idx" ON "payments"("status", "paid_at");
CREATE INDEX "payments_payment_method_paid_at_idx" ON "payments"("payment_method", "paid_at");
CREATE UNIQUE INDEX "payment_allocations_payment_id_monthly_charge_id_key" ON "payment_allocations"("payment_id", "monthly_charge_id");
CREATE INDEX "payment_allocations_monthly_charge_id_idx" ON "payment_allocations"("monthly_charge_id");

ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_user_id_fkey" FOREIGN KEY ("voided_by_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_monthly_charge_id_fkey" FOREIGN KEY ("monthly_charge_id") REFERENCES "monthly_charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
