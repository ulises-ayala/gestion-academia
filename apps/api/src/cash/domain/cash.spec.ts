import { Prisma } from '@academy/database';
import { describe, expect, it } from 'vitest';
import { cashTotals, parseCashAmount } from './cash';

describe('cash totals', () => {
  it('separa un pago mixto por medio', () => {
    const totals = cashTotals([
      { type: 'COLLECTION', method: 'CASH', amount: new Prisma.Decimal('30000') },
      { type: 'COLLECTION', method: 'MERCADO_PAGO', amount: new Prisma.Decimal('20000') },
    ]);
    expect(totals.CASH.toFixed(2)).toBe('30000.00');
    expect(totals.MERCADO_PAGO.toFixed(2)).toBe('20000.00');
    expect(totals.CARD.toFixed(2)).toBe('0.00');
  });

  it('resta reversals sin borrar collections', () => {
    const totals = cashTotals([
      { type: 'COLLECTION', method: 'CASH', amount: new Prisma.Decimal('100000') },
      { type: 'REVERSAL', method: 'CASH', amount: new Prisma.Decimal('20000') },
    ]);
    expect(totals.CASH.toFixed(2)).toBe('80000.00');
  });

  it('valida importes declarados como strings decimales no negativos', () => {
    expect(parseCashAmount('0', 'declared').toFixed(2)).toBe('0.00');
    expect(() => parseCashAmount('-1', 'declared')).toThrowError('decimal no negativo');
  });
});
