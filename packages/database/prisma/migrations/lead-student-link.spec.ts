import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261113120000_lead_student_link/migration.sql', import.meta.url),
  'utf8',
);

describe('Potencial alumno vinculado a su alumno', () => {
  it('agrega el vínculo opcional, único y sin tocar datos existentes', () => {
    expect(migration).toContain('ALTER TABLE "leads" ADD COLUMN "student_id" UUID;');
    expect(migration).toContain('CREATE UNIQUE INDEX "leads_student_id_key"');
    expect(migration).toContain('REFERENCES "students"("id") ON DELETE RESTRICT');
    expect(migration).not.toMatch(/NOT NULL|UPDATE "leads"|DELETE\s+FROM|DROP\s+/i);
  });
});
