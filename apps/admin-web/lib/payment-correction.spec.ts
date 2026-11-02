import type { PaymentDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import {
  correctionFormFrom,
  correctionPayload,
  correctionProblem,
  correctionTotalCents,
} from './payment-correction';

const payment = {
  id: 'p1',
  amount: '40000.00',
  paidAt: '2026-10-30T14:00:00.000Z',
  tenders: [{ id: 't1', method: 'CASH', amount: '40000.00' }],
} as unknown as PaymentDto;
const today = '2026-11-01';

describe('corregir pago', () => {
  it('arranca con los medios y la fecha del pago', () => {
    expect(correctionFormFrom(payment)).toEqual({
      tenders: { CASH: '40000', MERCADO_PAGO: '', CARD: '' },
      paidDate: '2026-10-30',
      reason: '',
    });
  });

  it('pasar de efectivo a Mercado Pago', () => {
    const form = {
      tenders: { CASH: '', MERCADO_PAGO: '40.000', CARD: '' },
      paidDate: '2026-10-30',
      reason: 'Era Mercado Pago',
    };
    expect(correctionProblem(payment, form, today)).toBeNull();
    expect(correctionTotalCents(form)).toBe(4000000n);
    expect(correctionPayload(payment, form)).toEqual({
      reason: 'Era Mercado Pago',
      tenders: [{ method: 'MERCADO_PAGO', amount: '40000.00' }],
    });
  });

  it('manda la fecha solo si cambió', () => {
    const form = { ...correctionFormFrom(payment), paidDate: '2026-10-15', reason: 'Pagó antes' };
    expect(correctionPayload(payment, form)).toMatchObject({ paidDate: '2026-10-15' });
  });

  it('pide un cambio, un motivo, una fecha válida e importes', () => {
    const base = correctionFormFrom(payment);
    expect(correctionProblem(payment, { ...base, reason: 'x x' }, today)).toBe(
      'No cambiaste nada del pago.',
    );
    const changed = { ...base, tenders: { ...base.tenders, CASH: '35000' } };
    expect(correctionProblem(payment, changed, today)).toBe('Contá el motivo de la corrección.');
    expect(
      correctionProblem(payment, { ...changed, reason: 'ok!', paidDate: '2026-11-05' }, today),
    ).toBe('La fecha del pago no puede ser futura.');
    expect(
      correctionProblem(
        payment,
        { ...base, tenders: { CASH: '', MERCADO_PAGO: '', CARD: '' }, reason: 'ok!' },
        today,
      ),
    ).toBe('Ingresá al menos un medio con importe.');
  });
});
