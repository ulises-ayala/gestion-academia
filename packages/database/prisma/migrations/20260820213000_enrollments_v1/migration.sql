CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'ENDED');

CREATE TABLE "enrollments" (
  "id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "enrollments_dates_check" CHECK ("end_date" IS NULL OR "end_date" >= "start_date")
);

CREATE INDEX "enrollments_student_id_status_idx" ON "enrollments"("student_id", "status");
CREATE INDEX "enrollments_class_id_status_idx" ON "enrollments"("class_id", "status");
CREATE UNIQUE INDEX "enrollments_active_student_class_key"
  ON "enrollments"("student_id", "class_id") WHERE "status" = 'ACTIVE';

ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
