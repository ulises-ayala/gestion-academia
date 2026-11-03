import type { MonthlyChargeDto, PaymentDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import {
  reallocationCreditCents,
  reallocationFormFrom,
  reallocationPayload,
  reallocationProblem,
  reallocationRows,
} from './payment-reallocation';

const charge = (id: string, period: string, outstanding: string, status = 'PENDING') =>
  ({
    id,
    period,
    dueDate: `${period}-10`,
    createdAt: `${period}-01T00:00:00.000Z`,
    outstandingAmount: outstanding,
    status,
  }) as MonthlyChargeDto;
const payment = {
  amount: '40000.00',
  refundedAmount: '0.00',
  allocations: [{ monthlyChargeId: 'sep', amount: '40000.00' }],
} as unknown as PaymentDto;
const charges = [
  charge('oct', '2026-10', '40000.00'),
  charge('sep', '2026-09', '0.00', 'PAID'),
  charge('aug', '2026-08', '0.00', 'PAID'),
];

describe('reimputar un pago', () => {
  const rows = reallocationRows(payment, charges);

  it('ofrece las cuotas del pago y las que deben, de la más vieja a la más nueva', () => {
    expect(rows.map((row) => [row.charge.id, row.currentCents, row.maxCents])).toEqual([
      ['sep', 4000000n, 4000000n],
      ['oct', 0n, 4000000n],
    ]);
    expect(reallocationFormFrom(rows)).toEqual({ sep: '40000', oct: '' });
  });

  it('pasa el pago de septiembre a octubre', () => {
    const form = { sep: '', oct: '40.000' };
    expect(reallocationProblem(payment, rows, form, 'pagaba octubre')).toBeNull();
    expect(reallocationPayload(form, ' pagaba octubre ')).toEqual({
      reason: 'pagaba octubre',
      allocations: [{ monthlyChargeId: 'oct', amount: '40000.00' }],
    });
  });

  it('lo que no se imputa queda como saldo a favor (un pago duplicado, entero)', () => {
    const partial = { sep: '10000', oct: '20000' };
    expect(reallocationProblem(payment, rows, partial, 'motivo')).toBeNull();
    expect(reallocationCreditCents(payment, partial)).toBe(1000000n);
    const none = { sep: '', oct: '' };
    expect(reallocationProblem(payment, rows, none, 'pagó dos veces')).toBeNull();
    expect(reallocationPayload(none, 'pagó dos veces').allocations).toEqual([]);
    expect(reallocationCreditCents(payment, none)).toBe(4000000n);
    // Lo ya devuelto no se puede volver a imputar.
    const refunded = { ...payment, refundedAmount: '10000.00' };
    expect(reallocationProblem(refunded, rows, { sep: '', oct: '40000' }, 'motivo')).toMatch(
      /no pueden sumar más de 30000.00/,
    );
  });

  it('explica por qué no se puede', () => {
    expect(reallocationProblem(payment, rows, { sep: '40000', oct: '' }, 'x')).toMatch(
      /No cambiaste/,
    );
    expect(reallocationProblem(payment, rows, { sep: '40000', oct: '10000' }, 'motivo')).toMatch(
      /no pueden sumar más de 40000.00/,
    );
    expect(reallocationProblem(payment, rows, { sep: '', oct: '50000' }, 'motivo')).toMatch(
      /hasta 40000.00/,
    );
    expect(reallocationProblem(payment, rows, { sep: '', oct: '40000' }, '')).toMatch(/motivo/);
  });
});
