import { describe, expect, it } from 'vitest';
import { cardSurchargePreviewCents } from './card-surcharge';

describe('recargo por tarjeta (vista previa)', () => {
  it('coincide con el cálculo de la API: débito 4,04 % y crédito 7,80 %, al centavo', () => {
    expect(cardSurchargePreviewCents(4_000_000n, 'DEBIT')).toBe(161_600n);
    expect(cardSurchargePreviewCents(4_000_000n, 'CREDIT')).toBe(312_000n);
    // 12.345 × 4,04 % = 498,738 → 498,74
    expect(cardSurchargePreviewCents(1_234_500n, 'DEBIT')).toBe(49_874n);
  });
});
