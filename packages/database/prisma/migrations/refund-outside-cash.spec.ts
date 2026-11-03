import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261103190000_refund_outside_cash/migration.sql', import.meta.url),
  'utf8',
);

describe('Devoluciones fuera de la caja', () => {
  it('el turno es opcional y solo el efectivo puede salir de uno', () => {
    expect(migration).toContain('ALTER COLUMN "cash_shift_id" DROP NOT NULL');
    expect(migration).toContain(`CHECK ("cash_shift_id" IS NULL OR "method" = 'CASH') NOT VALID`);
  });
});
