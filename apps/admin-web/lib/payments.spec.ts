import type { MonthlyChargeDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import {
  createPaymentPayload,
  decimalToCents,
  outstandingTotal,
  openCharges,
  paymentSubmissionDisabled,
  previewAllocations,
  tenderTotal,
} from './payments';

const charge = (
  id: string,
  outstandingAmount: string,
  dueDate: string,
  status: MonthlyChargeDto['status'] = 'PENDING',
) =>
  ({
    id,
    outstandingAmount,
    dueDate,
    status,
    createdAt: `${dueDate}T00:00:00.000Z`,
  }) as MonthlyChargeDto;

describe('payments UI helpers', () => {
  it('suma medios y deuda sin perder centavos', () => {
    const tenders = { CASH: '100.10', MERCADO_PAGO: '20,20', CARD: '' } as const;
    expect(tenderTotal(tenders)).toBe(12030n);
    expect(
      outstandingTotal([charge('a', '100.10', '2026-08-01'), charge('b', '20.20', '2026-09-01')]),
    ).toBe('120.30');
  });

  it('previsualiza la imputación por vencimiento y admite derrame parcial', () => {
    const charges = [
      charge('new', '50.00', '2026-09-10'),
      charge('old', '40.00', '2026-08-10', 'PARTIAL'),
    ];
    expect(
      previewAllocations(charges, 6000n).map(({ charge: item, amount }) => [item.id, amount]),
    ).toEqual([
      ['old', '40.00'],
      ['new', '20.00'],
    ]);
  });

  it('incluye PENDING y PARTIAL con saldo abierto', () => {
    const partial = {
      ...charge('partial', '20.00', '2026-08-10', 'PARTIAL'),
      paidAmount: '10.00',
      overdue: true,
    } as MonthlyChargeDto;
    expect(openCharges([partial, charge('paid', '0.00', '2026-07-10', 'PAID')])).toEqual([partial]);
    expect(partial.overdue).toBe(true);
  });

  it('deshabilita submit para cero, excedente, valor inválido o envío en curso', () => {
    expect(paymentSubmissionDisabled(0n, 100n, false, false)).toBe(true);
    expect(paymentSubmissionDisabled(101n, 100n, false, false)).toBe(true);
    expect(paymentSubmissionDisabled(50n, 100n, true, false)).toBe(true);
    expect(paymentSubmissionDisabled(50n, 100n, false, true)).toBe(true);
    expect(paymentSubmissionDisabled(50n, 100n, false, false)).toBe(false);
  });

  it('envía sólo medios con importe positivo y el alumno', () => {
    expect(
      createPaymentPayload('student-1', {
        CASH: '1000',
        MERCADO_PAGO: '500.25',
        CARD: '0',
      }),
    ).toEqual({
      studentId: 'student-1',
      tenders: [
        { method: 'CASH', amount: '1000.00' },
        { method: 'MERCADO_PAGO', amount: '500.25' },
      ],
    });
  });

  it('rechaza valores inválidos para el cálculo', () => {
    expect(decimalToCents('1.234')).toBeNull();
    expect(decimalToCents('-1')).toBeNull();
  });
});
