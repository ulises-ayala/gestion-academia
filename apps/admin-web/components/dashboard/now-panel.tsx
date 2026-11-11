import React, { type ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  ChevronRight,
  CircleCheck,
  CreditCard,
  UserRoundSearch,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import {
  classAttendanceState,
  type AlertKey,
  type DashboardAlert,
  type NowFocus,
} from '../../lib/dashboard-today';

const alertIcons: Readonly<Record<AlertKey, LucideIcon>> = {
  'student-follow-up': Users,
  'overdue-charges': CreditCard,
  'overdue-leads': UserRoundSearch,
};

const phaseLabel = {
  'in-progress': 'En curso desde las',
  upcoming: 'Próxima clase ·',
  missed: 'Asistencia sin registrar · clase de las',
  later: 'Próxima clase ·',
} as const;

const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

/**
 * Lo primero que hay que hacer (una sola prioridad, con su acción al lado) y, en la columna de al
 * lado, los demás pendientes y lo que se pase en `aside` (los números del día).
 */
export function NowPanel({
  focus,
  alerts,
  attendanceHref,
  canTakeAttendance,
  aside,
}: Readonly<{
  focus: NowFocus;
  alerts: readonly DashboardAlert[];
  attendanceHref: string;
  canTakeAttendance: boolean;
  aside?: ReactNode;
}>) {
  const secondary = alerts.filter(
    (alert) => focus.kind !== 'alert' || alert.key !== focus.alert.key,
  );
  // Una clase que ya terminó sin asistencia no es "ahora": quedó pendiente.
  const title = focus.kind === 'class' && focus.phase === 'missed' ? 'Quedó pendiente' : 'Ahora';
  const hasSide = secondary.length > 0 || Boolean(aside);
  return (
    <section aria-labelledby="now-title" className={`now-panel${hasSide ? ' has-side' : ''}`}>
      <div className="now-primary">
        <h2 id="now-title">{title}</h2>
        <FocusContent
          attendanceHref={attendanceHref}
          canTakeAttendance={canTakeAttendance}
          focus={focus}
        />
      </div>
      {hasSide && (
        <div className="now-side">
          {secondary.length > 0 && (
            <ul aria-label="Otros pendientes" className="now-alerts">
              {secondary.map((alert) => {
                const Icon = alertIcons[alert.key];
                return (
                  <li key={alert.key}>
                    <Link
                      aria-label={`${alert.title}. ${alert.action}`}
                      className={`now-alert now-alert--${alert.key}`}
                      href={alert.href}
                    >
                      <span className="now-alert-icon" aria-hidden="true">
                        <Icon size={16} strokeWidth={1.6} />
                      </span>
                      <span className="now-alert-copy">
                        <strong>{alert.title}</strong>
                        <small>{alert.description}</small>
                      </span>
                      <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {aside}
        </div>
      )}
    </section>
  );
}

function FocusContent({
  focus,
  attendanceHref,
  canTakeAttendance,
}: Readonly<{ focus: NowFocus; attendanceHref: string; canTakeAttendance: boolean }>) {
  if (focus.kind === 'clear')
    return (
      <div className="now-focus">
        <div className="now-focus-copy">
          <p className="now-eyebrow">Todo al día</p>
          <h3>No hay tareas urgentes</h3>
          <p className="now-meta">
            <CircleCheck aria-hidden="true" size={16} strokeWidth={1.6} />
            Sin clases pendientes ni alertas para hoy.
          </p>
        </div>
      </div>
    );
  if (focus.kind === 'alert') {
    const Icon = alertIcons[focus.alert.key];
    return (
      <div className="now-focus">
        <div className="now-focus-copy">
          <p className="now-eyebrow">
            <AlertTriangle aria-hidden="true" size={14} strokeWidth={1.75} />
            Requiere atención
          </p>
          <h3>{focus.alert.title}</h3>
          <p className="now-meta">{focus.alert.description}</p>
        </div>
        <Link className="button now-cta" href={focus.alert.href}>
          <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
          {focus.alert.action}
        </Link>
      </div>
    );
  }
  const { item, phase } = focus;
  const state = classAttendanceState(item);
  const showAttendance = canTakeAttendance && phase !== 'later';
  return (
    <div className="now-focus">
      <div className="now-focus-copy">
        <p className="now-eyebrow">
          {phaseLabel[phase]} {item.startTime}
        </p>
        <h3>
          {item.name} · {item.room}
        </h3>
        <p className="now-meta">
          <Users aria-hidden="true" size={16} strokeWidth={1.6} />
          {plural(item.enrolledStudents, 'alumno', 'alumnos')}
          {state === 'partial' && item.attendanceRecords !== null && (
            <> · {item.attendanceRecords} registrados</>
          )}
          <span aria-hidden="true">·</span>
          {item.teacher}
        </p>
      </div>
      {showAttendance ? (
        <Link className="button now-cta" href={attendanceHref}>
          <CalendarCheck aria-hidden="true" size={18} strokeWidth={1.75} />
          {state === 'partial' ? 'Completar asistencia' : 'Tomar asistencia'}
        </Link>
      ) : (
        <Link className="button secondary now-cta" href={`/classes/${item.id}`}>
          Ver clase
        </Link>
      )}
    </div>
  );
}
