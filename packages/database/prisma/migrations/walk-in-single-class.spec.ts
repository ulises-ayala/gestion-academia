import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261103150000_walk_in_single_class/migration.sql', import.meta.url),
  'utf8',
);

describe('Alumno eventual', () => {
  it('admite pagos sin alumno solo para la clase suelta de un eventual', () => {
    expect(migration).toContain('ALTER COLUMN "student_id" DROP NOT NULL');
    expect(migration).toContain('"payments_payer_check"');
    expect(migration).toContain(`"kind" = 'OTHER' AND "concept" = 'SINGLE_CLASS'`);
    expect(migration).not.toMatch(/UPDATE|DELETE/i);
  });
});
