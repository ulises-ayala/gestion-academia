import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261103120000_transfer_and_other_concepts/migration.sql', import.meta.url),
  'utf8',
);

describe('Transferencia y conceptos de otros cobros', () => {
  it('solo agrega valores a los enums, sin tocar pagos existentes', () => {
    expect(migration).toContain(`ALTER TYPE "PaymentMethod" ADD VALUE 'TRANSFER'`);
    expect(migration).toContain(`ALTER TYPE "OtherPaymentConcept" ADD VALUE 'APPAREL'`);
    expect(migration).toContain(`ALTER TYPE "OtherPaymentConcept" ADD VALUE 'GALA_SEAL'`);
    expect(migration).not.toMatch(/UPDATE|DELETE/i);
  });
});
