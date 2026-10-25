import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261024120000_controlfit_payment_import/migration.sql', import.meta.url),
  'utf8',
);

describe('ControlFit payment import migration', () => {
  it('marks existing payments as cash desk payments without rewriting them', () => {
    expect(migration).toContain(`"origin" "PaymentOrigin" NOT NULL DEFAULT 'CASH_DESK'`);
    expect(migration).not.toMatch(/UPDATE\s+"?payments"?/i);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });

  it('makes the legacy reference unique so imports are idempotent', () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "payments_legacy_reference_key"');
  });

  it('adds the historical discount adjustment type', () => {
    expect(migration).toContain(`ADD VALUE 'HISTORICAL_DISCOUNT'`);
  });
});
