import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260831190000_billing_adjustments_v1/migration.sql', import.meta.url),
  'utf8',
);

describe('billing adjustments v1 migration', () => {
  it('creates recurring conditions and append-only charge snapshots', () => {
    expect(migration).toContain('CREATE TABLE "enrollment_billing_conditions"');
    expect(migration).toContain('CREATE TABLE "monthly_charge_adjustments"');
    expect(migration).toContain('ON DELETE RESTRICT');
  });

  it('makes late-fee materialization and reversals idempotent', () => {
    expect(migration).toContain('monthly_charge_adjustments_one_late_fee_per_charge');
    expect(migration).toContain('WHERE "type" = \'LATE_FEE\'');
    expect(migration).toContain('monthly_charge_adjustments_reversal_of_id_key');
  });
});
