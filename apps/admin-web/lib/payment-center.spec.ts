import { describe, expect, it } from 'vitest';
import { paymentBackHref, paymentLocationFromSearch, paymentSearch } from './payment-center';

describe('payment center URL state', () => {
  it('opens pending accounts by default', () => {
    expect(paymentLocationFromSearch('')).toMatchObject({
      tab: 'accounts',
      scope: 'pending',
      sort: 'oldest',
      page: 1,
    });
  });

  it.each(['overdue', 'partial', 'unpaid'] as const)('consumes the %s deep link', (scope) => {
    expect(paymentLocationFromSearch(`?view=${scope}`).scope).toBe(scope);
  });

  it('keeps filters, search, order and pagination in the URL', () => {
    const href = paymentSearch('?view=overdue&q=perez&sort=oldest&page=2', {
      sort: 'highest-debt',
      page: 1,
    });
    expect(href).toContain('view=overdue');
    expect(href).toContain('q=perez');
    expect(href).toContain('sort=highest-debt');
    expect(href).toContain('page=1');
  });

  it('parses global history filters including mixed tender method', () => {
    expect(
      paymentLocationFromSearch(
        '?tab=history&historyQ=ana&paymentStatus=VOID&method=MERCADO_PAGO&from=2026-08-01&to=2026-08-31&historyPage=3',
      ),
    ).toMatchObject({
      tab: 'history',
      historyQ: 'ana',
      paymentStatus: 'VOID',
      paymentMethod: 'MERCADO_PAGO',
      from: '2026-08-01',
      to: '2026-08-31',
      historyPage: 3,
    });
  });

  it('returns to the preserved context after opening a student account', () => {
    expect(paymentBackHref('?view=overdue&q=ana&page=2&studentId=student&action=collect')).toBe(
      '/payments?view=overdue&q=ana&page=2',
    );
  });
});
