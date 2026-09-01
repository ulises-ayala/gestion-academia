import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260831213000_cash_shift_v1/migration.sql', import.meta.url),
  'utf8',
);

describe('Cash shift v1 migration', () => {
  it('protege un único turno abierto y una collection por tender', () => {
    expect(migration).toContain('cash_shifts_one_open_per_user_key');
    expect(migration).toContain('WHERE "status" = \'OPEN\'');
    expect(migration).toContain('cash_movements_collection_tender_key');
    expect(migration).toContain('WHERE "type" = \'COLLECTION\'');
  });

  it('conserva reversals y cierres como relaciones restrictivas', () => {
    expect(migration).toContain('cash_movements_reversal_of_id_key');
    expect(migration).not.toMatch(/ON DELETE CASCADE/i);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });
});
