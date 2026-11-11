import React from 'react';
import type { OperationalDashboardDto } from '@academy/contracts';
import { ChevronRight } from 'lucide-react';
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

/** Los números del día: deuda pendiente y cobrado hoy. El mes se mira en la pestaña "Este mes". */
export function ManagementSection({ data }: Readonly<{ data: OperationalDashboardDto }>) {
  const { billing, payments } = data;
  if (!billing && !payments) return null;
  const todayHref = `/payments?tab=history&from=${data.businessDate}&to=${data.businessDate}`;
  return (
    <section aria-labelledby="management-title" className="day-figures">
      <h2 className="sr-only" id="management-title">
        Gestión
      </h2>
      {billing && (
        <article className="day-figure">
          <h3>
            Deuda pendiente
            <InfoHint
              label="deuda pendiente"
              text="Saldo de todas las cuotas no anuladas que todavía tienen importe por cobrar. Una cuota está vencida si tiene saldo y su vencimiento es anterior al día operativo; en ese caso incluye el recargo por mora si aún no se aplicó."
            />
          </h3>
          <strong>{money.format(Number(billing.pendingDebt))}</strong>
          <p>
            {plural(billing.pendingCharges, 'cuota pendiente', 'cuotas pendientes')} ·{' '}
            {plural(billing.overdueCharges, 'vencida', 'vencidas')}
            {billing.overdueStudents > 0 &&
              ` · ${plural(billing.overdueStudents, 'alumno', 'alumnos')}`}
          </p>
          <Link className="text-link" href={dashboardContextLinks.pendingDebt}>
            Ver detalle
            <ChevronRight aria-hidden="true" size={14} strokeWidth={1.75} />
          </Link>
        </article>
      )}
      {payments && (
        <article className="day-figure">
          <h3>Cobrado hoy</h3>
          <strong>{money.format(Number(payments.confirmedAmountToday))}</strong>
          <p>{plural(payments.confirmedToday, 'pago registrado', 'pagos registrados')}</p>
          <Link className="text-link" href={todayHref}>
            Ver detalle
            <ChevronRight aria-hidden="true" size={14} strokeWidth={1.75} />
          </Link>
        </article>
      )}
    </section>
  );
}
