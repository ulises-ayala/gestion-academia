-- CreateEnum
CREATE TYPE "public"."AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'JUSTIFIED');

-- CreateTable
CREATE TABLE "public"."student_attendances" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "attendance_date" DATE NOT NULL,
    "status" "public"."AttendanceStatus" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_attendances_attendance_date_idx" ON "public"."student_attendances"("attendance_date");

-- CreateIndex
CREATE INDEX "student_attendances_enrollment_id_idx" ON "public"."student_attendances"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendances_enrollment_id_attendance_date_key" ON "public"."student_attendances"("enrollment_id", "attendance_date");

-- AddForeignKey
ALTER TABLE "public"."student_attendances" ADD CONSTRAINT "student_attendances_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
