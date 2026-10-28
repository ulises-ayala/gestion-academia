import type { PaymentDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import {
  amountInputValue,
  chargeLabel,
  chargesProblem,
  emptyTenders,
  historicalDebtPayload,
  historicalDebtProblem,
  paymentSummary,
  pickTotalCents,
  tendersFrom,
  type TenderPick,
} from './collect-payment';

const pick = (over: Partial<TenderPick> = {}): TenderPick => ({
  mode: 'CASH',
  amount: '',
  split: emptyTenders,
  ...over,
});

describe('popup de cobro', () => {
  it('nombra la cuota por su mes y la deuda anterior por su detalle', () => {
    expect(chargeLabel({ kind: 'MONTHLY', description: null, period: '2026-10' })).toBe(
      'Octubre de 2026',
    );
    expect(
      chargeLabel({ kind: 'HISTORICAL_DEBT', description: 'ControlFit', period: '2026-09' }),
    ).toBe('Deuda anterior: ControlFit');
  });

  it('con un medio va todo el importe a ese medio; mixto suma cada medio', () => {
    expect(tendersFrom(pick({ mode: 'MERCADO_PAGO', amount: '28000' }))).toEqual({
      CASH: '',
      MERCADO_PAGO: '28000',
      CARD: '',
    });
    const mixed = pick({
      mode: 'MIXED',
      amount: '999',
      split: { CASH: '10000', MERCADO_PAGO: '', CARD: '5000,50' },
    });
    expect(pickTotalCents(mixed)).toBe(1500050n);
  });

  it('permite pago parcial pero no más que la deuda', () => {
    const debt = 21000000n; // $210.000
    expect(chargesProblem(pick({ amount: '100000' }), debt)).toBeNull();
    expect(chargesProblem(pick({ amount: '250000' }), debt)).toMatch(/supera la deuda/);
    expect(chargesProblem(pick({ amount: '' }), debt)).toBe('Ingresá el importe recibido.');
    expect(chargesProblem(pick({ amount: '1000' }), 0n)).toMatch(/generá la cuota/);
  });

  it('entiende el importe con puntos de miles y coma decimal', () => {
    expect(pickTotalCents(pick({ amount: '210.000' }))).toBe(21000000n);
    expect(pickTotalCents(pick({ amount: '$ 1.500,50' }))).toBe(150050n);
    expect(pickTotalCents(pick({ amount: '1500.5' }))).toBe(150050n);
    expect(pickTotalCents(pick({ amount: '28000' }))).toBe(2800000n);
  });

  it('precarga la deuda como se escribe acá', () => {
    expect(amountInputValue(4100000n)).toBe('41.000');
    expect(amountInputValue(21100050n)).toBe('211.000,50');
    expect(amountInputValue(0n)).toBe('');
    expect(pickTotalCents(pick({ amount: amountInputValue(21100050n) }))).toBe(21100050n);
  });

  it('valida y arma la deuda anterior', () => {
    const form = { enrollmentId: 'e1', amount: '210.000', description: ' ControlFit ' };
    expect(historicalDebtProblem({ ...form, enrollmentId: '' })).toMatch(/clase/);
    expect(historicalDebtProblem({ ...form, amount: '0' })).toMatch(/monto/);
    expect(historicalDebtProblem({ ...form, description: 'x' })).toMatch(/corresponde/);
    expect(historicalDebtProblem({ ...form, amount: '210000' })).toBeNull();
    expect(historicalDebtPayload({ ...form, amount: '210000,5' })).toEqual({
      enrollmentId: 'e1',
      amount: '210000.50',
      description: 'ControlFit',
    });
  });

  it('resume el cobro para el comprobante', () => {
    const summary = paymentSummary({
      amount: '100000.00',
      kind: 'CHARGES',
      otherConcept: null,
      tenders: [{ id: 't', method: 'CASH', amount: '100000.00' }],
      allocations: [
        {
          monthlyChargeId: 'd',
          amount: '100000.00',
          kind: 'HISTORICAL_DEBT',
          description: 'ControlFit',
          period: '2026-09',
          dueDate: '2026-09-01',
          academicClass: { id: 'c', name: 'Salsa' },
          finalAmount: '210000.00',
          studentDueAmount: '210000.00',
        },
      ],
    } as unknown as PaymentDto);
    expect(summary.methods).toBe('Efectivo');
    expect(summary.detail).toMatch(/^Deuda anterior: ControlFit/);
  });
});
