'use client';

import type {
  OperationalDashboardDto,
  StudentFollowUpItemDto,
  StudentFollowUpResponseDto,
} from '@academy/contracts';
import { ChevronRight, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api-client';
import { formatDate } from '../../lib/dates';
import { followUpWhen, personInitials } from '../../lib/dashboard-today';
import { InfoHint } from './info-hint';

type Leads = NonNullable<OperationalDashboardDto['leads']>;
const leadStatus = { INQUIRY: 'Consulta', INTERESTED: 'Interesado/a', TRIAL: 'Clase de prueba' };
const STUDENT_LIMIT = 3;

type StudentsState =
  | Readonly<{ status: 'loading' | 'error' }>
  | Readonly<{ status: 'ready'; items: readonly StudentFollowUpItemDto[] }>;

const uniqueStudents = (items: readonly StudentFollowUpItemDto[]) => {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.studentId) && seen.add(item.studentId));
};

export function FollowUpPanel({
  leads,
  businessDate,
  canSeeStudents,
  refreshKey,
}: Readonly<{
  leads: Leads | undefined;
  businessDate: string;
  canSeeStudents: boolean;
  refreshKey: string;
}>) {
  const [students, setStudents] = useState<StudentsState>({ status: 'loading' });
  const load = useCallback(async () => {
    if (!canSeeStudents) return;
    setStudents((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    try {
      const response = await apiRequest<StudentFollowUpResponseDto>(
        `/students/follow-up?page=1&pageSize=${STUDENT_LIMIT * 2}`,
      );
      setStudents({
        status: 'ready',
        items: uniqueStudents(response.items).slice(0, STUDENT_LIMIT),
      });
    } catch {
      setStudents({ status: 'error' });
    }
  }, [canSeeStudents]);
  useEffect(() => void load(), [load, refreshKey]);

  const leadItems =
    leads?.priority.slice(0, 5 - (students.status === 'ready' ? students.items.length : 0)) ?? [];
  const studentItems = students.status === 'ready' ? students.items : [];
  const empty =
    leadItems.length === 0 &&
    (!canSeeStudents || (students.status === 'ready' && studentItems.length === 0));

  return (
    <section aria-labelledby="follow-up-title" className="card dashboard-panel follow-up-panel">
      <header className="dashboard-panel-header">
        <div>
          <h2 id="follow-up-title">
            Seguimientos pendientes
            <InfoHint
              label="seguimientos pendientes"
              text="Alumnos con 3 o más ausencias consecutivas en una inscripción activa y potenciales alumnos con un próximo contacto agendado, del más urgente al más lejano."
            />
          </h2>
          <p>Alumnos y potenciales que requieren atención</p>
        </div>
        <Link
          className="button secondary panel-link"
          href={canSeeStudents ? '/students/follow-up' : '/leads?followUp=pending'}
        >
          Ver todos
          <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} />
        </Link>
      </header>
      {canSeeStudents && students.status === 'error' && (
        <div className="panel-inline-error" role="alert">
          <span>No pudimos cargar los alumnos en seguimiento.</span>
          <button className="secondary" onClick={() => void load()} type="button">
            <RotateCw aria-hidden="true" size={14} strokeWidth={1.75} />
            Reintentar
          </button>
        </div>
      )}
      {canSeeStudents && students.status === 'loading' && (
        <p className="dashboard-empty" role="status">
          Cargando alumnos en seguimiento…
        </p>
      )}
      {empty ? (
        <p className="dashboard-empty">No hay seguimientos pendientes. ¡Todo al día!</p>
      ) : (
        <ul className="follow-up-list">
          {studentItems.map((item) => (
            <li key={item.studentId}>
              <Link className="follow-up-item" href={`/students/${item.studentId}`}>
                <span className="person-avatar" aria-hidden="true">
                  {personInitials(item.studentName)}
                </span>
                <span className="follow-up-copy">
                  <strong>{item.studentName}</strong>
                  <small>Alumno · {item.className}</small>
                  <span>
                    {item.lastPresentAt
                      ? `Última asistencia: ${formatDate(item.lastPresentAt)}. Confirmar continuidad.`
                      : 'Sin asistencias como presente. Confirmar continuidad.'}
                  </span>
                </span>
                <span className="follow-up-when is-urgent">
                  {item.consecutiveAbsences} ausencias
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="follow-up-chevron"
                  size={16}
                  strokeWidth={1.75}
                />
              </Link>
            </li>
          ))}
          {leadItems.map((lead) => {
            const when = followUpWhen(lead.nextFollowUpAt, lead.overdue, businessDate);
            return (
              <li key={lead.id}>
                <Link className="follow-up-item" href={`/leads/${lead.id}`}>
                  <span className="person-avatar" aria-hidden="true">
                    {personInitials(lead.name)}
                  </span>
                  <span className="follow-up-copy">
                    <strong>{lead.name}</strong>
                    <small>
                      Potencial ·{' '}
                      {leadStatus[lead.status as keyof typeof leadStatus] ?? lead.status}
                    </small>
                    <span>
                      {lead.overdue ? 'El contacto agendado ya pasó.' : 'Contacto agendado.'}
                    </span>
                  </span>
                  <span
                    className={`follow-up-when ${when === 'Vencido' || when === 'Hoy' ? 'is-urgent' : ''}`}
                  >
                    {when}
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="follow-up-chevron"
                    size={16}
                    strokeWidth={1.75}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
