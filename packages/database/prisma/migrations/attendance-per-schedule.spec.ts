import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261027230000_attendance_per_schedule/migration.sql', import.meta.url),
  'utf8',
);

describe('Asistencia por horario', () => {
  it('permite una asistencia por horario y una sola fuera de horario por día', () => {
    expect(migration).toContain(
      'DROP INDEX "student_attendances_enrollment_id_attendance_date_key"',
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "student_attendances_enrollment_date_schedule_key"[\s\S]*NULLS NOT DISTINCT/,
    );
  });

  it('asigna las asistencias existentes al horario de su clase sin borrar nada', () => {
    expect(migration).toMatch(/UPDATE "student_attendances"[\s\S]*"class_schedules"/);
    expect(migration).toContain('ON DELETE RESTRICT');
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });
});
