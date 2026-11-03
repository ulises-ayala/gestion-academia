import { describe, expect, it } from 'vitest';
import { closingPayload, closingPeriodLabel, closingPreviewQuery } from './closings';

describe('cierres', () => {
  it('nombra el período como lo lee la academia', () => {
    expect(closingPeriodLabel('WEEKLY', '2026-11-02', '2026-11-08')).toBe(
      'Del 02/11/2026 al 08/11/2026',
    );
    expect(closingPeriodLabel('MONTHLY', '2026-10-01', '2026-10-31')).toBe('Octubre de 2026');
  });

  it('arma el pedido y la vista previa según el tipo de cierre', () => {
    const week = { fromDate: '2026-11-02', toDate: '2026-11-08' };
    expect(closingPayload('WEEKLY', week)).toEqual({ kind: 'WEEKLY', ...week });
    expect(closingPayload('MONTHLY', { fromDate: '2026-10-01', toDate: '2026-10-31' })).toEqual({
      kind: 'MONTHLY',
      month: '2026-10',
    });
    expect(closingPreviewQuery('WEEKLY', week)).toBe('kind=WEEKLY&from=2026-11-02&to=2026-11-08');
    expect(closingPreviewQuery('MONTHLY', null)).toBe('kind=MONTHLY');
  });
});
