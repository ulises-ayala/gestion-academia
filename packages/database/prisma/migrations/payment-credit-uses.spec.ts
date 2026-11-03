import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261103210000_payment_credit_uses/migration.sql', import.meta.url),
  'utf8',
);

describe('Saldo a favor usado en otros cobros', () => {
  it('registra de qué pago sale y a qué cobro va, sin tocar la caja', () => {
    expect(migration).toContain('CREATE TABLE "payment_credit_uses"');
    expect(migration).toContain('CHECK ("amount" > 0)');
    expect(migration).toContain('CHECK ("source_payment_id" <> "target_payment_id")');
    expect(migration).not.toMatch(/cash_movements/);
  });
});
