import type { OperationalDashboardDto } from '@academy/contracts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConfirmedPaymentsChart, compactMoney } from './confirmed-payments-chart';

const financial = (
  amounts: readonly string[],
): NonNullable<OperationalDashboardDto['financial']> => ({
  currentMonthConfirmed: amounts[5]!,
  previousMonthConfirmed: amounts[4]!,
  variationPercent: '25.0',
  lastSixMonthsConfirmed: '450.00',
  monthlyConfirmed: amounts.map((amount, index) => ({
    year: 2026,
    month: index + 3,
    label: ['Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'][index]!,
    fullLabel: ['Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto'][index]! + ' 2026',
    amount,
  })),
});

describe('ConfirmedPaymentsChart', () => {
  it('renders six accessible bars, metrics, ARS values and the disclaimer', () => {
    const html = renderToStaticMarkup(
      <ConfirmedPaymentsChart data={financial(['0', '0', '0', '0', '200', '250'])} />,
    );
    expect(html).toContain('Evolución de cobros');
    expect(html.match(/payment-bar-column/g)).toHaveLength(6);
    expect(html).toContain('Agosto 2026: 250 pesos');
    expect(html).toContain('Cobrado este mes');
    expect(html).toContain('Variación');
    expect(html).toContain('pagos confirmados registrados');
    expect(compactMoney(2_400_000)).toContain('2,4 M');
  });

  it('shows an explicit empty state when all six months are zero', () => {
    const html = renderToStaticMarkup(
      <ConfirmedPaymentsChart
        data={{
          ...financial(['0', '0', '0', '0', '0', '0']),
          variationPercent: null,
          lastSixMonthsConfirmed: '0.00',
        }}
      />,
    );
    expect(html).toContain('Todavía no hay cobros confirmados para mostrar.');
    expect(html).toContain('Sin comparación');
  });
});
