import { ChevronRight, CircleCheck, CircleDashed, Clock3, Minus } from 'lucide-react';
import Link from 'next/link';
import {
  classAttendanceState,
  type ClassAttendanceState,
  type TodayClass,
} from '../../lib/dashboard-today';

const stateCopy: Readonly<
  Record<Exclude<ClassAttendanceState, 'unknown'>, { label: string; className: string }>
> = {
  complete: { label: 'Completada', className: 'is-complete' },
  partial: { label: 'Parcial', className: 'is-partial' },
  pending: { label: 'Pendiente', className: 'is-pending' },
  'no-students': { label: 'Sin alumnos', className: 'is-empty' },
};

export function TodayAgenda({
  classes,
  dateLabel,
  focusId,
  attendanceHref,
  canTakeAttendance,
}: Readonly<{
  classes: readonly TodayClass[];
  dateLabel: string;
  focusId: string | null;
  attendanceHref: string;
  canTakeAttendance: boolean;
}>) {
  return (
    <section aria-labelledby="agenda-title" className="card dashboard-panel agenda-panel">
      <header className="dashboard-panel-header">
        <div>
          <h2 id="agenda-title">Agenda de hoy</h2>
          <p>{dateLabel}</p>
        </div>
        <Link
          className="button secondary panel-link"
          href={canTakeAttendance ? attendanceHref : '/classes'}
        >
          {canTakeAttendance ? 'Ir a asistencias' : 'Ver clases'}
          <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} />
        </Link>
      </header>
      {classes.length === 0 ? (
        <p className="dashboard-empty">No hay clases programadas para hoy.</p>
      ) : (
        <div className="agenda-table" role="table" aria-label="Clases de hoy">
          <div className="agenda-row agenda-head" role="row">
            <span role="columnheader">Hora</span>
            <span role="columnheader">Clase</span>
            <span role="columnheader">Sala</span>
            <span role="columnheader">Alumnos</span>
            <span role="columnheader">Asistencia</span>
          </div>
          {classes.map((item, index) => {
            const state = classAttendanceState(item);
            const copy = state === 'unknown' ? null : stateCopy[state];
            const Icon =
              state === 'complete'
                ? CircleCheck
                : state === 'partial'
                  ? CircleDashed
                  : state === 'no-students'
                    ? Minus
                    : Clock3;
            return (
              <Link
                aria-current={item.id === focusId ? 'step' : undefined}
                className={`agenda-row ${item.id === focusId ? 'is-focus' : ''}`}
                href={canTakeAttendance ? attendanceHref : `/classes/${item.id}`}
                key={`${item.id}-${item.startTime}-${index}`}
                role="row"
              >
                <span className="agenda-time" role="cell">
                  {item.startTime}
                </span>
                <span className="agenda-class" role="cell">
                  <strong>{item.name}</strong>
                  <small>Prof. {item.teacher}</small>
                </span>
                <span className="agenda-room" role="cell">
                  {item.room}
                </span>
                <span className="agenda-count" role="cell">
                  <span className="agenda-mobile-label">Alumnos: </span>
                  {item.enrolledStudents}
                </span>
                <span className="agenda-state" role="cell">
                  {copy ? (
                    <span className={`attendance-pill ${copy.className}`}>
                      <Icon aria-hidden="true" size={15} strokeWidth={1.75} />
                      {copy.label}
                      {state === 'partial' && (
                        <span className="sr-only">
                          {' '}
                          ({item.attendanceRecords} de {item.enrolledStudents})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="agenda-muted">—</span>
                  )}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="agenda-chevron"
                  size={16}
                  strokeWidth={1.75}
                />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
