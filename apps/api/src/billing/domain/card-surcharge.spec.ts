import { describe, expect, it } from 'vitest';
import { cardSurchargeFor, parseCardType } from './card-surcharge';

describe('recargo por tarjeta', () => {
  it('débito 4,04 % y crédito 7,80 % sobre lo que se paga con tarjeta, al centavo', () => {
    expect(cardSurchargeFor([{ method: 'CARD', amount: '40000.00' }], 'DEBIT')).toEqual({
      amount: '1616.00',
      detail: 'Débito 4,04 %',
    });
    expect(cardSurchargeFor([{ method: 'CARD', amount: '40000.00' }], 'CREDIT')).toEqual({
      amount: '3120.00',
      detail: 'Crédito 7,80 %',
    });
    // Pago mixto: solo la parte con tarjeta; 12345 × 4,04 % = 498,738 → 498,74.
    expect(
      cardSurchargeFor(
        [
          { method: 'CASH', amount: '20000.00' },
          { method: 'CARD', amount: '12345.00' },
        ],
        'DEBIT',
      )?.amount,
    ).toBe('498.74');
  });

  it('exige tarjeta y un tipo válido', () => {
    expect(() => cardSurchargeFor([{ method: 'CASH', amount: '1000' }], 'DEBIT')).toThrow(
      expect.objectContaining({ details: { field: 'cardType' } }),
    );
    expect(parseCardType(undefined)).toBeNull();
    expect(() => parseCardType('PREPAID')).toThrow(
      expect.objectContaining({ details: { field: 'cardType' } }),
    );
  });
});
