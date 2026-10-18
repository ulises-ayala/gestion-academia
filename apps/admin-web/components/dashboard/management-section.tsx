import type { OperationalDashboardDto } from '@academy/contracts';
import { BarChart3, ChevronRight, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { dashboardContextLinks } from '../../lib/contextual-filters';
import { ConfirmedPaymentsChart } from '../confirmed-payments-chart';
import { InfoHint } from './info-hint';

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

export function ManagementSection({
  data,
  showChart,
}: Readonly<{ data: OperationalDashboardDto; showChart: boolean }>) {
  const { billing, payments, financial } = data;
  if (!billing && !payments && !financial) return null;
  const currentMonth = financial?.monthlyConfirmed.at(-1);
  const variation = financial?.variationPercent == null ? null : Number(financial.variationPercent);
  const todayHref = `/payments?tab=history&from=${data.businessDate}&to=${data.businessDate}`;
  return (
    <section aria-labelledby="management-title" className="management-section">
      <h2 className="dashboard-section-title" id="management-title">
        Gestión
      </h2>
      <div className={`management-grid ${showChart && financial ? 'has-chart' : ''}`}>
        {billing && (
          <article className="card management-card">
            <span className="management-icon is-warning" aria-hidden="true">
              <CreditCard size={20} strokeWidth={1.6} />
            </span>
            <div className="management-body">
              <h3>
                Deuda pendiente
                <InfoHint
                  label="deuda pendiente"
                  text="Saldo de todas las cuotas no anuladas que todavía tienen importe por cobrar. Una cuota está vencida si tiene saldo y su vencimiento es anterior al día operativo; en ese caso incluye el recargo por mora si aún no se aplicó."
                />
              </h3>
              <p className="management-caption">
                {plural(billing.pendingCharges, 'cuota pendiente', 'cuotas pendientes')}
              </p>
              <strong className="management-value">
                {money.format(Number(billing.pendingDebt))}
              </strong>
              <p className="management-detail">
                {plural(billing.overdueCharges, 'vencida', 'vencidas')}
                {billing.overdueStudents > 0 &&
                  ` · ${plural(billing.overdueStudents, 'alumno', 'alumnos')}`}
              </p>
            </div>
            <Link className="button secondary panel-link" href={dashboardContextLinks.pendingDebt}>
              Ver detalle
              <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} />
            </Link>
          </article>
        )}
        {(financial || payments) && (
          <article className="card management-card">
            <span className="management-icon is-success" aria-hidden="true">
              <BarChart3 size={20} strokeWidth={1.6} />
            </span>
            <div className="management-body">
              {financial ? (
                <>
                  <h3>
                    Cobros del mes
                    <InfoHint
                      label="cobros del mes"
                      text="Pagos confirmados durante el mes calendario en curso. No incluye pagos anulados ni constituye un saldo de caja."
                    />
                  </h3>
                  <p className="management-caption">{currentMonth?.fullLabel}</p>
                  <strong className="management-value">
                    {money.format(Number(financial.currentMonthConfirmed))}
                  </strong>
                  <p className="management-detail">
                    {variation === null
                      ? 'Sin comparación con el mes anterior'
                      : `${variation > 0 ? '+' : ''}${variation.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% vs. mes anterior`}
                  </p>
                  {payments && (
                    <p className="management-detail">
                      Hoy: {money.format(Number(payments.confirmedAmountToday))} ·{' '}
                      {plural(payments.confirmedToday, 'pago', 'pagos')}
                    </p>
                  )}
                </>
              ) : (
                payments && (
                  <>
                    <h3>Cobrado hoy</h3>
                    <p className="management-caption">Pagos confirmados</p>
                    <strong className="management-value">
                      {money.format(Number(payments.confirmedAmountToday))}
                    </strong>
                    <p className="management-detail">
                      {plural(payments.confirmedToday, 'pago registrado', 'pagos registrados')}
                    </p>
                  </>
                )
              )}
            </div>
            <Link className="button secondary panel-link" href={payments ? todayHref : '/reports'}>
              Ver detalle
              <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} />
            </Link>
          </article>
        )}
        {showChart && financial && <ConfirmedPaymentsChart data={financial} variant="compact" />}
      </div>
    </section>
  );
}
