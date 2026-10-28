import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261028190000_single_class_teacher/migration.sql', import.meta.url),
  'utf8',
);

describe('Profesor de la clase suelta', () => {
  it('guarda el profesor en el cobro y completa las clases sueltas ya registradas', () => {
    expect(migration).toContain('ADD COLUMN "teacher_id" UUID');
    expect(migration).toMatch(/UPDATE "payments"[\s\S]*"concept" = 'SINGLE_CLASS'/);
  });

  it('exige clase y profesor en la clase suelta y ninguno en los demás cobros', () => {
    expect(migration).toMatch(/"class_id" IS NOT NULL AND "teacher_id" IS NOT NULL/);
    expect(migration).toMatch(/"kind" = 'CHARGES'[\s\S]*"teacher_id" IS NULL/);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });
});
