import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261106120000_void_monthly_charge/migration.sql', import.meta.url),
  'utf8',
);

describe('Anular cuota', () => {
  it('la cuota anulada no ocupa su mes y no cambia datos', () => {
    expect(migration).toContain(`WHERE "kind" = 'MONTHLY' AND "status" <> 'VOID'`);
    expect(migration).not.toMatch(/UPDATE\s|DELETE\s/i);
  });
});
