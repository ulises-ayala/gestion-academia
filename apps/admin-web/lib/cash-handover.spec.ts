import type { CashHandoverDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import { handoverPayload, handoverProblem, nextHandoverPeriod } from './cash-handover';

const handover = (toDate: string, voidedAt: string | null = null) =>
  ({ toDate, voidedAt }) as CashHandoverDto;
const form = {
  fromDate: '2026-11-02',
  toDate: '2026-11-08',
  amount: '350.000',
  receivedBy: '',
  note: '',
};

describe('entrega de efectivo', () => {
  it('propone desde el día siguiente a la última entrega vigente hasta hoy', () => {
    expect(
      nextHandoverPeriod([handover('2026-11-01'), handover('2026-11-07', 'x')], '2026-11-08'),
    ).toEqual({ fromDate: '2026-11-02', toDate: '2026-11-08' });
    expect(nextHandoverPeriod([handover('2026-11-08')], '2026-11-08')).toEqual({
      fromDate: '',
      toDate: '2026-11-08',
    });
    expect(nextHandoverPeriod([], '2026-11-08')).toEqual({
      fromDate: '2026-11-02',
      toDate: '2026-11-08',
    });
  });

  it('valida y arma el pedido', () => {
    expect(handoverProblem(form, '2026-11-08')).toBeNull();
    expect(handoverProblem({ ...form, amount: '' }, '2026-11-08')).toMatch(/importe/);
    expect(handoverProblem({ ...form, toDate: '2026-11-09' }, '2026-11-08')).toMatch(/futuro/);
    expect(handoverPayload(form)).toEqual({
      fromDate: '2026-11-02',
      toDate: '2026-11-08',
      amount: '350000.00',
      receivedBy: null,
      note: null,
    });
  });
});
