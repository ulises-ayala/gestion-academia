-- Preserve legacy end dates, statuses and history: no defaults or backfill.
CREATE TYPE "EnrollmentEndReason" AS ENUM (
  'NO_LONGER_ATTENDING', 'SCHEDULE_CHANGE', 'DISCIPLINE_CHANGE',
  'PERSONAL_REASONS', 'NON_PAYMENT', 'OTHER'
);
ALTER TABLE "enrollments"
  ADD COLUMN "end_reason" "EnrollmentEndReason",
  ADD COLUMN "end_note" VARCHAR(500);
