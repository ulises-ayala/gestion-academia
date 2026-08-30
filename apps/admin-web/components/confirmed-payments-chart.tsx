import type { OperationalDashboardDto } from '@academy/contracts';
import React from 'react';

type FinancialData = NonNullable<OperationalDashboardDto['financial']>;
const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const pesos = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

export function ConfirmedPaymentsChart({ data }: Readonly<{ data: FinancialData }>) {
  const amounts = data.monthlyConfirmed.map((item) => Number(item.amount));
  const maximum = Math.max(...amounts, 0);
  const empty = maximum === 0;
  const variation = data.variationPercent === null ? null : Number(data.variationPercent);
  return (
    <section className="card dashboard-card financial-card">
      <div className="dashboard-card-title">
        <div>
          <p className="eyebrow">INFORMACIÓN PARA GESTIÓN</p>
          <h2>Evolución de cobros</h2>
        </div>
        <span className="financial-period">Últimos 6 meses</span>
      </div>
      {empty ? (
        <p className="dashboard-empty financial-empty">
          Todavía no hay cobros confirmados para mostrar.
        </p>
      ) : (
        <div aria-label="Cobros confirmados por mes" className="payment-chart" role="img">
          {data.monthlyConfirmed.map((item) => {
            const amount = Number(item.amount);
            const height =
              maximum === 0 ? 0 : Math.max((amount / maximum) * 100, amount > 0 ? 4 : 0);
            return (
              <div
                className="payment-bar-column"
                key={`${item.year}-${item.month}`}
                title={`${item.fullLabel}: ${ars.format(amount)}`}
              >
                <span className="payment-bar-value">{compactMoney(amount)}</span>
                <span
                  aria-label={`${item.fullLabel}: ${pesos.format(amount)} pesos`}
                  className="payment-bar-track"
                >
                  <span className="payment-bar" style={{ height: `${height}%` }} />
                </span>
                <strong>{item.label}</strong>
              </div>
            );
          })}
        </div>
      )}
      <div className="financial-metrics">
        <FinancialMetric
          label="Cobrado este mes"
          value={ars.format(Number(data.currentMonthConfirmed))}
        />
        <FinancialMetric
          label="Mes anterior"
          value={ars.format(Number(data.previousMonthConfirmed))}
        />
        <FinancialMetric
          label="Variación"
          value={
            variation === null
              ? 'Sin comparación'
              : `${variation > 0 ? '↑ +' : variation < 0 ? '↓ ' : ''}${variation.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
          }
          tone={
            variation === null || variation === 0
              ? undefined
              : variation > 0
                ? 'positive'
                : 'warning'
          }
        />
        <FinancialMetric
          label="Últimos 6 meses"
          value={ars.format(Number(data.lastSixMonthsConfirmed))}
        />
      </div>
      <p className="financial-disclaimer">
        Los importes son pagos confirmados registrados en el sistema; no constituyen un indicador
        contable ni un saldo disponible.
      </p>
    </section>
  );
}

function FinancialMetric({
  label,
  value,
  tone,
}: Readonly<{ label: string; value: string; tone?: 'positive' | 'warning' | undefined }>) {
  return (
    <div className="financial-metric">
      <span>{label}</span>
      <strong className={tone ? `financial-${tone}` : ''}>{value}</strong>
    </div>
  );
}

export const compactMoney = (amount: number) => {
  if (amount >= 1_000_000)
    return `$${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(amount / 1_000_000)} M`;
  if (amount >= 1_000)
    return `$${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount / 1_000)} mil`;
  return ars.format(amount);
};
