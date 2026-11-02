import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261102230000_payment_reallocation/migration.sql', import.meta.url),
  'utf8',
);

describe('Reimputar pago', () => {
  it('agrega filas sin modificar la imputación original', () => {
    expect(migration).toContain('CREATE TABLE "payment_reallocations"');
    expect(migration).toContain('ADD COLUMN "reallocation_id" UUID');
    expect(migration).toContain('WHERE "reallocation_id" IS NULL');
    expect(migration).toContain('"amount" < 0 AND "reallocation_id" IS NOT NULL');
    expect(migration).not.toMatch(/UPDATE\s+"payment_allocations"/i);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });
});
