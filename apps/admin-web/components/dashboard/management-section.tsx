import React from 'react';
import type { OperationalDashboardDto } from '@academy/contracts';
import { BarChart3, ChevronRight, CreditCard, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { dashboardContextLinks } from '../../lib/contextual-filters';
import { InfoHint } from './info-hint';

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

/** Lo de hoy en plata: deuda pendiente y cobrado en el día. El mes se mira en el Tablero. */
export function ManagementSection({ data }: Readonly<{ data: OperationalDashboardDto }>) {
  const { billing, payments } = data;
  if (!billing && !payments) return null;
  const todayHref = `/payments?tab=history&from=${data.businessDate}&to=${data.businessDate}`;
  return (
    <section aria-labelledby="management-title" className="management-section">
      <h2 className="dashboard-section-title" id="management-title">
        Gestión
      </h2>
      <div className="management-grid">
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
        {payments && (
          <article className="card management-card">
            <span className="management-icon is-success" aria-hidden="true">
              <BarChart3 size={20} strokeWidth={1.6} />
            </span>
            <div className="management-body">
              <h3>Cobrado hoy</h3>
              <p className="management-caption">Pagos confirmados</p>
              <strong className="management-value">
                {money.format(Number(payments.confirmedAmountToday))}
              </strong>
              <p className="management-detail">
                {plural(payments.confirmedToday, 'pago registrado', 'pagos registrados')}
              </p>
            </div>
            <Link className="button secondary panel-link" href={todayHref}>
              Ver detalle
              <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} />
            </Link>
          </article>
        )}
      </div>
      <Link className="text-link management-board-link" href="/board">
        <TrendingUp aria-hidden="true" size={16} strokeWidth={1.75} />
        Ver cómo viene el mes en el Tablero
      </Link>
    </section>
  );
}
