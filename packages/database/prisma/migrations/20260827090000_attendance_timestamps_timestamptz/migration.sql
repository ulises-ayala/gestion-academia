-- Align attendance audit timestamps with the UTC-aware convention used by the project.
ALTER TABLE "student_attendances"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- The unique index on (enrollment_id, attendance_date) already covers enrollment_id lookups.
DROP INDEX "student_attendances_enrollment_id_idx";
