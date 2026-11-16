import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261116120000_sales_to_non_students/migration.sql', import.meta.url),
  'utf8',
);

describe('Ventas a quien no es alumno', () => {
  it('admite otros cobros sin alumno, no solo la clase suelta, y nunca cuotas', () => {
    expect(migration).toContain('DROP CONSTRAINT "payments_payer_check"');
    expect(migration).toContain(
      `"student_id" IS NULL AND "walk_in_name" IS NOT NULL AND "kind" = 'OTHER')`,
    );
    expect(migration).not.toContain('SINGLE_CLASS');
    expect(migration).not.toMatch(/UPDATE|DELETE/i);
  });
});
