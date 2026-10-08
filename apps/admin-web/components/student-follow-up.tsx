import type { StudentFollowUpItemDto } from '@academy/contracts';
import React from 'react';
import Link from 'next/link';
import { formatDate } from '../lib/dates';

export function FollowUpIndicator({
  item,
}: Readonly<{ item: StudentFollowUpItemDto | undefined }>) {
  if (!item || item.consecutiveAbsences < 3) return null;
  return (
    <div className="follow-up-indicator">
      <strong>Requiere seguimiento</strong>
      <span>{item.consecutiveAbsences} ausencias consecutivas</span>
      <span>
        Última asistencia:{' '}
        {item.lastPresentAt
          ? formatDate(item.lastPresentAt)
          : 'Sin asistencias registradas como presente'}
      </span>
    </div>
  );
}

export function FollowUpTable({
  items,
  canEnd,
  onEnd,
}: Readonly<{
  items: readonly StudentFollowUpItemDto[];
  canEnd: boolean;
  onEnd(item: StudentFollowUpItemDto): void;
}>) {
  const status = { PRESENT: 'Presente', ABSENT: 'Ausente', JUSTIFIED: 'Justificada' };
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Alumno</th>
            <th>Actividad</th>
            <th>Profesor</th>
            <th>Ausencias consecutivas</th>
            <th>Última asistencia</th>
            <th>Último registro</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.enrollmentId}>
              <td data-label="Alumno">
                <div>
                  <strong>{item.studentName}</strong>
                  <br />
                  DNI {item.studentDni}
                </div>
              </td>
              <td data-label="Actividad">{item.className}</td>
              <td data-label="Profesor">{item.teacherName}</td>
              <td data-label="Ausencias consecutivas">
                <div>
                  <strong>{item.consecutiveAbsences}</strong>
                  <br />
                  Requiere seguimiento
                </div>
              </td>
              <td data-label="Última asistencia">
                {item.lastPresentAt
                  ? formatDate(item.lastPresentAt)
                  : 'Sin asistencias registradas como presente'}
              </td>
              <td data-label="Último registro">
                <div>
                  {formatDate(item.lastAttendanceRecordAt)}
                  <br />
                  {item.lastAttendanceStatus ? status[item.lastAttendanceStatus] : 'Sin registros'}
                </div>
              </td>
              <td data-label="Acciones">
                <div className="follow-up-actions">
                  <Link className="text-link" href={`/students/${item.studentId}`}>
                    Ver alumno
                  </Link>
                  {canEnd && (
                    <button type="button" className="secondary" onClick={() => onEnd(item)}>
                      Finalizar inscripción
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FollowUpEmpty({ globalTotal }: Readonly<{ globalTotal: number }>) {
  return (
    <div className="empty-state">
      <h2>{globalTotal ? 'No encontramos alumnos con estos filtros.' : '¡Todo al día!'}</h2>
      {!globalTotal && <p>No hay alumnos con 3 o más ausencias consecutivas registradas.</p>}
    </div>
  );
}

export function FollowUpDashboardLink({ students }: Readonly<{ students: number }>) {
  return (
    <Link href="/students/follow-up">
      <strong>{students}</strong>
      <span>
        Alumnos para seguimiento <small>Ver detalle →</small>
      </span>
    </Link>
  );
}
