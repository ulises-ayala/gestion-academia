import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261103130000_cash_handovers/migration.sql', import.meta.url),
  'utf8',
);

describe('Entregas de efectivo a Dirección', () => {
  it('guarda la entrega aparte de la caja y exige anulación completa', () => {
    expect(migration).toContain('CREATE TABLE "cash_handovers"');
    expect(migration).toContain('CHECK ("amount" > 0)');
    expect(migration).toContain('CHECK ("to_date" >= "from_date")');
    expect(migration).toContain('"cash_handovers_void_complete"');
    expect(migration).not.toMatch(/cash_movements|cash_shifts/);
  });
});
