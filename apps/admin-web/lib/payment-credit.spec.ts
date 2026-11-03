import { describe, expect, it } from 'vitest';
import { hasCredit, refundPayload, refundProblem } from './payment-credit';

const payment = { creditAmount: '10000.00', status: 'CONFIRMED' as const };

describe('saldo a favor', () => {
  it('solo un pago confirmado con algo sin imputar tiene saldo a favor', () => {
    expect(hasCredit(payment)).toBe(true);
    expect(hasCredit({ ...payment, creditAmount: '0.00' })).toBe(false);
    expect(hasCredit({ ...payment, status: 'VOID' })).toBe(false);
  });

  it('devuelve hasta el saldo a favor, con motivo', () => {
    expect(refundProblem(payment, '', 'motivo')).toBe('Ingresá cuánto se devuelve.');
    expect(refundProblem(payment, '10.000,01', 'motivo')).toBe('Se puede devolver hasta 10000.00.');
    expect(refundProblem(payment, '10.000', '')).toBe('Contá por qué se devuelve.');
    expect(refundProblem(payment, '10.000', 'pagó dos veces')).toBeNull();
    expect(refundPayload('2.500,5', 'MERCADO_PAGO', ' pagó dos veces ')).toEqual({
      amount: '2500.50',
      method: 'MERCADO_PAGO',
      reason: 'pagó dos veces',
    });
  });
});
