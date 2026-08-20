'use client';
import type { ClassDto, EnrollmentListDto } from '@academy/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ClassForm } from '../../../components/class-form';
import { ApiClientError, apiRequest } from '../../../lib/api-client';
import { formatDate } from '../../../lib/dates';
import { dayLabels } from '../../../lib/offering';
export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<ClassDto | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentListDto['items']>([]);
  const [edit, setEdit] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    try {
      const [classData, enrollmentData] = await Promise.all([
        apiRequest<ClassDto>(`/classes/${id}`),
        apiRequest<EnrollmentListDto>(`/enrollments?classId=${id}&status=ACTIVE&pageSize=100`),
      ]);
      setItem(classData);
      setEnrollments(enrollmentData.items);
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cargar la clase');
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!item) return <p>{message || 'Cargando…'}</p>;
  async function toggle() {
    if (!item) return;
    if (item.status === 'ACTIVE' && !confirm('¿Desactivar esta clase?')) return;
    try {
      setItem(
        await apiRequest<ClassDto>(
          item.status === 'ACTIVE' ? `/classes/${item.id}` : `/classes/${item.id}/reactivate`,
          { method: item.status === 'ACTIVE' ? 'DELETE' : 'POST' },
        ),
      );
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cambiar el estado');
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <Link className="back-link" href="/classes">
            ← Volver
          </Link>
          <h1>{item.name}</h1>
          <p>
            {item.danceType.name} · {item.teacher.firstName} {item.teacher.lastName}
          </p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => setEdit(!edit)}>
            Editar
          </button>
          <button onClick={() => void toggle()}>
            {item.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}
          </button>
        </div>
      </div>
      {message && <p className="message">{message}</p>}
      {edit && (
        <section className="card">
          <ClassForm
            academicClass={item}
            onSaved={(value) => {
              setItem(value);
              setEdit(false);
            }}
            onCancel={() => setEdit(false)}
          />
        </section>
      )}
      <section className="card">
        <h2>Información</h2>
        <dl className="detail-grid">
          <div>
            <dt>Nivel</dt>
            <dd>{item.level ?? '—'}</dd>
          </div>
          <div>
            <dt>Cupo utilizado</dt>
            <dd>
              {enrollments.length} / {item.capacity}
            </dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{item.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</dd>
          </div>
        </dl>
        <h2 className="section-title">Horarios</h2>
        <ul className="schedule-list">
          {item.schedules.map((s) => (
            <li key={s.id}>
              {dayLabels[s.dayOfWeek]} {s.startTime}–{s.endTime} · {s.room.branch.name} /{' '}
              {s.room.name}
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>
          Alumnos inscriptos ({enrollments.length} / {item.capacity})
        </h2>
        {enrollments.length === 0 ? (
          <p className="empty-state">No hay alumnos inscriptos.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>DNI</th>
                  <th>Teléfono</th>
                  <th>Desde</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td>
                      {enrollment.student.firstName} {enrollment.student.lastName}
                    </td>
                    <td>{enrollment.student.dni}</td>
                    <td>{enrollment.student.phone ?? '—'}</td>
                    <td>{formatDate(enrollment.startDate)}</td>
                    <td>
                      <Link className="text-link" href={`/students/${enrollment.studentId}`}>
                        Ver ficha
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
