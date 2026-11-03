import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  readFileSync(new URL(`./${name}/migration.sql`, import.meta.url), 'utf8');

describe('Devoluciones de saldo a favor', () => {
  it('agrega el egreso REFUND en una migración propia', () => {
    const type = read('20261103170000_cash_refund_type');
    expect(type).toContain(`ALTER TYPE "CashMovementType" ADD VALUE 'REFUND'`);
    expect(type).not.toMatch(/CONSTRAINT/);
  });

  it('liga cada devolución a su movimiento de caja sin tocar datos existentes', () => {
    const refunds = read('20261103170100_payment_refunds');
    expect(refunds).toContain('CREATE TABLE "payment_refunds"');
    expect(refunds).toContain('"payment_refunds_positive_amount_check"');
    expect(refunds).toContain(
      `("type" = 'REFUND' AND "reversal_of_id" IS NULL AND "refund_id" IS NOT NULL)`,
    );
    // Ninguna sentencia que reescriba datos (ON UPDATE CASCADE de las claves no cuenta).
    expect(refunds).not.toMatch(/^\s*(UPDATE|DELETE FROM)\b/im);
  });
});
