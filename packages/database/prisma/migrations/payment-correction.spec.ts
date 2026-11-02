import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261101230000_payment_correction/migration.sql', import.meta.url),
  'utf8',
);

describe('Corregir pago', () => {
  it('el reemplazo apunta al pago original y cada pago se corrige una sola vez', () => {
    expect(migration).toContain('ADD COLUMN "correction_of_id" UUID');
    expect(migration).toContain('CREATE UNIQUE INDEX "payments_correction_of_id_key"');
    expect(migration).toContain('ON DELETE RESTRICT');
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });
});
