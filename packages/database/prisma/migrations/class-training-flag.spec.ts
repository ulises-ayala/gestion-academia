import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261116150000_class_training_flag/migration.sql', import.meta.url),
  'utf8',
);

describe('Clases de formación', () => {
  it('agrega la marca sin marcar ninguna clase ni tocar datos', () => {
    expect(migration).toContain(
      'ALTER TABLE "classes" ADD COLUMN "is_training" BOOLEAN NOT NULL DEFAULT false',
    );
    expect(migration).not.toMatch(/UPDATE|DELETE|DROP/i);
  });
});
