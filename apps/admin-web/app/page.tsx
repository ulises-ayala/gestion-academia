'use client';

import type { OperationalDashboardDto } from '@academy/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '../components/admin-shell';
import { ConfirmedPaymentsChart } from '../components/confirmed-payments-chart';
import { useAuth } from '../components/auth-provider';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { dashboardContextLinks, dashboardQuickActions } from '../lib/contextual-filters';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const dateTime = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Buenos_Aires',
  dateStyle: 'short',
  timeStyle: 'short',
});
const statusLabels = { INQUIRY: 'Consulta', INTERESTED: 'Interesado/a', TRIAL: 'Clase de prueba' };
const actionLabels: Readonly<Record<string, string>> = {
  UPDATE: 'Actualización',
  STATUS_CHANGE: 'Cambio de estado',
  ROLE_CHANGE: 'Cambio de rol',
  VOID: 'Anulación',
  CORRECTION: 'Corrección',
  END: 'Finalización',
  OPEN: 'Apertura',
  CLOSE: 'Cierre',
};
const entityLabels: Readonly<Record<string, string>> = {
  STUDENT: 'Alumno',
  LEAD: 'Potencial alumno',
  TEACHER: 'Profesor',
  ACADEMY_CLASS: 'Clase',
  TARIFF: 'Tarifa',
  ADMIN_USER: 'Usuario',
  PAYMENT: 'Pago',
  ATTENDANCE: 'Asistencia',
  ENROLLMENT: 'Inscripción',
  CASH_SHIFT: 'Turno de caja',
};

const greeting = () => {
  const hour = Number(
    new Intl.DateTimeFormat('en', {
      timeZone: 'America/Buenos_Aires',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()),
  );
  return hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
};

function Dashboard() {
  const { user, can } = useAuth();
  const [data, setData] = useState<OperationalDashboardDto | null>(null);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setMessage('');
    try {
      setData(await apiRequest<OperationalDashboardDto>('/dashboard/operational'));
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cargar el resumen.');
    }
  }, []);
  useEffect(() => void load(), [load]);

  if (!data && !message) return <p className="dashboard-loading">Cargando resumen operativo…</p>;
  if (!data)
    return (
      <section className="empty-state dashboard-error">
        <h1>No pudimos cargar el inicio</h1>
        <p className="error">{message}</p>
        <button onClick={() => void load()}>Reintentar</button>
      </section>
    );
  const urgent = (data.billing?.overdueCharges ?? 0) + (data.leads?.overdueFollowUps ?? 0);
  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">RESUMEN OPERATIVO</p>
          <h1>
            {greeting()}, {user.username}
          </h1>
          <p>Lo más importante de hoy, en un solo lugar.</p>
        </div>
        <span className="dashboard-date">{data.businessDate.split('-').reverse().join('/')}</span>
      </header>
      <section className="card dashboard-card quick-actions-card">
        <div>
          <p className="eyebrow">ACCIONES RÁPIDAS</p>
          <h2>¿Qué querés hacer hoy?</h2>
        </div>
        <div className="quick-actions">
          {dashboardQuickActions
            .filter(([, , permission]) => can(permission))
            .map(([label, href]) => (
              <Link className="button quick-action" href={href} key={label}>
                {label}
                <span aria-hidden="true">→</span>
              </Link>
            ))}
        </div>
      </section>
      <section aria-label="Indicadores principales" className="metric-grid">
        {data.students && (
          <Metric
            href={dashboardContextLinks.activeStudents}
            label="Alumnos activos"
            value={data.students.active}
          />
        )}
        {data.classes && (
          <Metric href="/classes" label="Clases activas" value={data.classes.active} />
        )}
        {data.billing && (
          <Metric
            href={dashboardContextLinks.pendingDebt}
            label="Deuda pendiente"
            value={money.format(Number(data.billing.pendingDebt))}
            detail={`${data.billing.pendingCharges} cuotas`}
          />
        )}
        {data.payments && (
          <Metric
            href={`/payments?tab=history&from=${data.businessDate}&to=${data.businessDate}`}
            label="Cobrado hoy"
            value={money.format(Number(data.payments.confirmedAmountToday))}
            detail={`${data.payments.confirmedToday} pagos confirmados`}
          />
        )}
      </section>
      <section
        className={`card dashboard-card attention-card attention-primary ${urgent > 0 ? 'has-urgent' : ''}`}
      >
        <p className="eyebrow">REQUIERE ATENCIÓN</p>
        <h2>{urgent > 0 ? `${urgent} pendientes` : 'Todo al día'}</h2>
        {urgent === 0 ? (
          <p className="dashboard-empty">No hay alertas operativas urgentes.</p>
        ) : (
          <div className="attention-list">
            {data.billing && data.billing.overdueCharges > 0 && (
              <Link href={dashboardContextLinks.overdueCharges}>
                <strong>{data.billing.overdueCharges}</strong>
                <span>
                  cuotas vencidas <small>Ver detalle →</small>
                </span>
              </Link>
            )}
            {data.leads && data.leads.overdueFollowUps > 0 && (
              <Link href={dashboardContextLinks.overdueFollowUps}>
                <strong>{data.leads.overdueFollowUps}</strong>
                <span>
                  seguimientos vencidos <small>Ver detalle →</small>
                </span>
              </Link>
            )}
          </div>
        )}
      </section>
      {data.financial && can('reports:operational') && (
        <ConfirmedPaymentsChart data={data.financial} />
      )}
      <div className="dashboard-columns">
        <div className="dashboard-stack">
          <section className="card dashboard-card">
            <div className="dashboard-card-title">
              <div>
                <p className="eyebrow">HOY</p>
                <h2>Clases programadas</h2>
              </div>
              {data.classes && <strong>{data.classes.scheduledToday}</strong>}
            </div>
            {!data.classes || data.classes.today.length === 0 ? (
              <p className="dashboard-empty">No hay clases programadas para hoy.</p>
            ) : (
              <div className="dashboard-list">
                {data.classes.today.map((item, index) => (
                  <Link
                    className="schedule-row"
                    href={`/classes/${item.id}`}
                    key={`${item.id}-${index}`}
                  >
                    <strong>{item.startTime}</strong>
                    <span>
                      <b>{item.name}</b>
                      <small>
                        {item.teacher} · {item.room}, {item.branch}
                      </small>
                    </span>
                    <span>{item.endTime}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
          {data.leads && (
            <section className="card dashboard-card">
              <div className="dashboard-card-title">
                <div>
                  <p className="eyebrow">SEGUIMIENTO</p>
                  <h2>Potenciales alumnos</h2>
                </div>
                <Link href="/leads">Ver todos</Link>
              </div>
              <div className="mini-metrics">
                <Link href="/leads?status=INQUIRY">
                  <strong>{data.leads.inquiry}</strong> consultas
                </Link>
                <Link href="/leads?status=INTERESTED">
                  <strong>{data.leads.interested}</strong> interesados
                </Link>
                <Link href="/leads?status=TRIAL">
                  <strong>{data.leads.trial}</strong> pruebas
                </Link>
              </div>
              {data.leads.priority.length === 0 ? (
                <p className="dashboard-empty">No hay seguimientos pendientes.</p>
              ) : (
                <div className="dashboard-list">
                  {data.leads.priority.map((lead) => (
                    <Link className="lead-row" href={`/leads/${lead.id}`} key={lead.id}>
                      <span>
                        <b>{lead.name}</b>
                        <small>{statusLabels[lead.status as keyof typeof statusLabels]}</small>
                      </span>
                      <span className={lead.overdue ? 'status danger' : 'status warning'}>
                        {lead.overdue ? 'Vencido' : dateTime.format(new Date(lead.nextFollowUpAt))}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
          {data.audit && (
            <section className="card dashboard-card">
              <div className="dashboard-card-title">
                <div>
                  <p className="eyebrow">TRAZABILIDAD</p>
                  <h2>Actividad reciente</h2>
                </div>
                <Link href="/audit">Ver auditoría</Link>
              </div>
              {data.audit.items.length === 0 ? (
                <p className="dashboard-empty">Todavía no hay movimientos auditados.</p>
              ) : (
                <div className="dashboard-list">
                  {data.audit.items.map((item) => (
                    <Link className="audit-row" href="/audit" key={item.id}>
                      <span>
                        <b>
                          {actionLabels[item.action] ?? item.action} ·{' '}
                          {entityLabels[item.entityType] ?? item.entityType}
                        </b>
                        <small>Por {item.actorUsername}</small>
                      </span>
                      <time>{dateTime.format(new Date(item.createdAt))}</time>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        <aside className="dashboard-stack">
          <section
            className={`card dashboard-card attention-card ${urgent > 0 ? 'has-urgent' : ''}`}
          >
            <p className="eyebrow">REQUIERE ATENCIÓN</p>
            <h2>{urgent > 0 ? `${urgent} pendientes` : 'Todo al día'}</h2>
            {urgent === 0 ? (
              <p className="dashboard-empty">No hay alertas operativas urgentes.</p>
            ) : (
              <div className="attention-list">
                {data.billing && data.billing.overdueCharges > 0 && (
                  <Link href={dashboardContextLinks.overdueCharges}>
                    <strong>{data.billing.overdueCharges}</strong>
                    <span>
                      cuotas vencidas <small>Ver detalle →</small>
                    </span>
                  </Link>
                )}
                {data.leads && data.leads.overdueFollowUps > 0 && (
                  <Link href={dashboardContextLinks.overdueFollowUps}>
                    <strong>{data.leads.overdueFollowUps}</strong>
                    <span>
                      seguimientos vencidos <small>Ver detalle →</small>
                    </span>
                  </Link>
                )}
              </div>
            )}
          </section>
          {data.attendance && (
            <section className="card dashboard-card">
              <p className="eyebrow">ASISTENCIA DE HOY</p>
              <h2>{data.attendance.classesWithRecords} clases registradas</h2>
              <div className="attendance-summary">
                <span>
                  <strong>{data.attendance.present}</strong> Presentes
                </span>
                <span>
                  <strong>{data.attendance.absent}</strong> Ausentes
                </span>
                <span>
                  <strong>{data.attendance.justified}</strong> Justificadas
                </span>
              </div>
              <Link className="dashboard-link" href={`/attendances?date=${data.businessDate}`}>
                Ir a asistencias
              </Link>
            </section>
          )}
          <section className="card dashboard-card legacy-quick-actions">
            <p className="eyebrow">ACCESOS RÁPIDOS</p>
            <h2>¿Qué querés hacer?</h2>
            <div className="quick-actions">
              {dashboardQuickActions
                .filter(([, , permission]) => can(permission))
                .map(([label, href]) => (
                  <Link className="button secondary" href={href} key={href}>
                    {label}
                  </Link>
                ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  href,
}: Readonly<{ label: string; value: string | number; detail?: string; href: string }>) {
  return (
    <Link className="metric-card" href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
      <small className="metric-action">Ver detalle →</small>
    </Link>
  );
}

export default function HomePage() {
  return (
    <AdminShell>
      <Dashboard />
    </AdminShell>
  );
}
