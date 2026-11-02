import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261103140000_card_surcharge/migration.sql', import.meta.url),
  'utf8',
);

describe('Recargo por tarjeta', () => {
  it('es un concepto más de los otros cobros', () => {
    expect(migration).toContain(`ALTER TYPE "OtherPaymentConcept" ADD VALUE 'CARD_SURCHARGE'`);
    expect(migration).not.toMatch(/UPDATE|DELETE/i);
  });
});
