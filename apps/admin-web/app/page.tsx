'use client';

import type { OperationalDashboardDto } from '@academy/contracts';
import {
  CalendarCheck,
  Contact,
  CreditCard,
  ListPlus,
  RotateCw,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '../components/admin-shell';
import { useAuth } from '../components/auth-provider';
import { FollowUpPanel } from '../components/dashboard/follow-up-panel';
import { ManagementSection } from '../components/dashboard/management-section';
import { NowPanel } from '../components/dashboard/now-panel';
import { TodayAgenda } from '../components/dashboard/today-agenda';
import { PageContainer } from '../components/ui/page-container';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { dashboardQuickActions } from '../lib/contextual-filters';
import {
  BUSINESS_TIME_ZONE,
  businessClock,
  dashboardAlerts,
  longBusinessDate,
  nowFocus,
} from '../lib/dashboard-today';

const quickActionIcons: Readonly<Record<string, LucideIcon>> = {
  'Nuevo alumno': UserPlus,
  'Registrar pago': CreditCard,
  'Tomar asistencia': CalendarCheck,
  'Nuevo potencial': Contact,
  'Inscribir alumno': ListPlus,
  'Abrir o consultar caja': Wallet,
};

const clockTime = new Intl.DateTimeFormat('es-AR', {
  timeZone: BUSINESS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const greeting = (clock: string) => {
  const hour = Number(clock.slice(0, 2));
  return hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
};

const presentUsername = (username: string) =>
  `${username.charAt(0).toLocaleUpperCase('es-AR')}${username.slice(1)}`;

/** Re-renderiza cada minuto para que "Ahora" avance sin recargar datos. */
function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

type LoadState = Readonly<{
  data: OperationalDashboardDto | null;
  error: string;
  refreshing: boolean;
}>;

function Dashboard() {
  const { user, can } = useAuth();
  const now = useMinuteClock();
  const [state, setState] = useState<LoadState>({ data: null, error: '', refreshing: true });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, error: '', refreshing: true }));
    try {
      const data = await apiRequest<OperationalDashboardDto>('/dashboard/operational');
      setState({ data, error: '', refreshing: false });
    } catch (error) {
      setState((current) => ({
        ...current,
        refreshing: false,
        error: error instanceof ApiClientError ? error.message : 'No se pudo cargar el resumen.',
      }));
    }
  }, []);
  useEffect(() => void load(), [load]);

  const { data, error, refreshing } = state;
  if (!data && !error)
    return (
      <p aria-busy="true" className="dashboard-loading" role="status">
        Cargando tu jornada…
      </p>
    );
  if (!data)
    return (
      <section className="empty-state dashboard-error" role="alert">
        <h1>No pudimos cargar el inicio</h1>
        <p className="error">{error}</p>
        <button disabled={refreshing} onClick={() => void load()} type="button">
          {refreshing ? 'Reintentando…' : 'Reintentar'}
        </button>
      </section>
    );

  const clock = businessClock(now);
  const classes = data.classes?.today ?? [];
  const alerts = dashboardAlerts(data, can);
  const focus = nowFocus(classes, alerts, clock);
  const canTakeAttendance = can('attendance:manage');
  const attendanceHref = `/attendances?date=${data.businessDate}`;
  const updatedAt = clockTime.format(new Date(data.generatedAt));
  const quickActions = dashboardQuickActions.filter(([, , permission]) => can(permission));

  return (
    <PageContainer className="dashboard-page" width="wide">
      <div aria-busy={refreshing} className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <h1>
              {greeting(clock)}, {presentUsername(user.username)}
            </h1>
            <p>
              <time dateTime={data.businessDate}>{longBusinessDate(data.businessDate)}</time>
            </p>
          </div>
          <div className="dashboard-refresh">
            <span aria-live="polite" role="status">
              {refreshing ? 'Actualizando…' : `Actualizado a las ${updatedAt}`}
            </span>
            <button
              aria-label="Actualizar inicio"
              className="secondary shell-icon-button dashboard-refresh-button"
              disabled={refreshing}
              onClick={() => void load()}
              title="Actualizar"
              type="button"
            >
              <RotateCw aria-hidden="true" size={16} strokeWidth={1.75} />
            </button>
          </div>
        </header>

        {error && (
          <div className="dashboard-stale" role="alert">
            <span>
              No pudimos actualizar el inicio ({error}). Mostramos los datos de las {updatedAt}.
            </span>
            <button className="secondary" onClick={() => void load()} type="button">
              Reintentar
            </button>
          </div>
        )}

        {quickActions.length > 0 && (
          <section aria-labelledby="quick-actions-title" className="frequent-actions">
            <h2 className="sr-only" id="quick-actions-title">
              Acciones frecuentes
            </h2>
            <div className="frequent-actions-list">
              {quickActions.map(([label, href]) => {
                const Icon = quickActionIcons[label];
                return (
                  <Link className="button secondary frequent-action" href={href} key={label}>
                    {Icon && <Icon aria-hidden="true" size={16} strokeWidth={1.6} />}
                    {label}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <NowPanel
          alerts={alerts}
          attendanceHref={attendanceHref}
          canTakeAttendance={canTakeAttendance}
          focus={focus}
        />

        <ManagementSection data={data} showChart={can('reports:operational')} />

        <section aria-label="Hoy" className="today-stack">
          {data.classes && (
            <TodayAgenda
              attendanceHref={attendanceHref}
              canTakeAttendance={canTakeAttendance}
              classes={classes}
              dateLabel={longBusinessDate(data.businessDate)}
              focusId={focus.kind === 'class' ? focus.item.id : null}
            />
          )}
          {(data.leads || can('students:manage')) && (
            <FollowUpPanel
              businessDate={data.businessDate}
              canSeeStudents={can('students:manage')}
              leads={data.leads}
              refreshKey={data.generatedAt}
            />
          )}
        </section>
      </div>
    </PageContainer>
  );
}

export default function HomePage() {
  return (
    <AdminShell>
      <Dashboard />
    </AdminShell>
  );
}
