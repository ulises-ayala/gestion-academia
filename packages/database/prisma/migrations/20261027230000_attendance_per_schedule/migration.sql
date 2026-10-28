-- Asistencia por horario: un alumno que cursa dos horarios de la misma clase el mismo día
-- tiene una asistencia por cada horario. schedule_id NULL = asistencia fuera de horario
-- (la clase no se dicta ese día), y de esas sigue habiendo una sola por inscripción y día.
ALTER TABLE "student_attendances" ADD COLUMN "schedule_id" UUID;

-- Las asistencias ya cargadas pasan al horario de su clase en ese día de la semana:
-- primero el activo y, si hay varios, el que empieza antes.
UPDATE "student_attendances" AS a
SET "schedule_id" = (
  SELECT s."id"
  FROM "class_schedules" AS s
  JOIN "enrollments" AS e ON e."class_id" = s."class_id"
  WHERE e."id" = a."enrollment_id"
    AND s."day_of_week" = (
      CASE EXTRACT(DOW FROM a."attendance_date")::int
        WHEN 0 THEN 'SUNDAY'
        WHEN 1 THEN 'MONDAY'
        WHEN 2 THEN 'TUESDAY'
        WHEN 3 THEN 'WEDNESDAY'
        WHEN 4 THEN 'THURSDAY'
        WHEN 5 THEN 'FRIDAY'
        ELSE 'SATURDAY'
      END
    )::"DayOfWeek"
  ORDER BY (s."status" = 'ACTIVE') DESC, s."start_time" ASC, s."created_at" ASC, s."id" ASC
  LIMIT 1
);

ALTER TABLE "student_attendances"
  ADD CONSTRAINT "student_attendances_schedule_id_fkey"
  FOREIGN KEY ("schedule_id") REFERENCES "class_schedules"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "student_attendances_enrollment_id_attendance_date_key";

CREATE UNIQUE INDEX "student_attendances_enrollment_date_schedule_key"
  ON "student_attendances"("enrollment_id", "attendance_date", "schedule_id") NULLS NOT DISTINCT;

CREATE INDEX "student_attendances_schedule_id_attendance_date_idx"
  ON "student_attendances"("schedule_id", "attendance_date");
