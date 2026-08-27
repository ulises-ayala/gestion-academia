'use client';
import type { ClassDto, EnrollmentListDto } from '@academy/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ClassForm } from '../../../components/class-form';
import { ApiClientError, apiRequest } from '../../../lib/api-client';
import { formatDate } from '../../../lib/dates';
import { dayLabels } from '../../../lib/offering';
import { resolveClassOccupancy } from '../../../lib/class-occupancy';
import { PermissionGate } from '../../../components/permission-gate';
const pageSize = 25;
export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<ClassDto | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentListDto>({
    items: [],
    total: 0,
    page: 1,
    pageSize,
  });
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    try {
      const [classData, enrollmentData] = await Promise.all([
        apiRequest<ClassDto>(`/classes/${id}`),
        apiRequest<EnrollmentListDto>(
          `/enrollments?classId=${id}&status=ACTIVE&page=${page}&pageSize=${pageSize}`,
        ),
      ]);
      setItem(classData);
      setEnrollments(enrollmentData);
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cargar la clase');
    }
  }, [id, page]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!item) return <p>{message || 'Cargando…'}</p>;
  const occupancy = resolveClassOccupancy(item.activeEnrollmentCount, enrollments.total);
  const totalPages = Math.max(1, Math.ceil(enrollments.total / enrollments.pageSize));
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
        <PermissionGate permission="offering:manage">
          <div className="actions">
            <button className="secondary" onClick={() => setEdit(!edit)}>
              Editar
            </button>
            <button onClick={() => void toggle()}>
              {item.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}
            </button>
          </div>
        </PermissionGate>
      </div>
      {message && <p className="message">{message}</p>}
      <PermissionGate permission="offering:manage">
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
      </PermissionGate>
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
              {occupancy} / {item.capacity}
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
          Alumnos inscriptos ({occupancy} / {item.capacity})
        </h2>
        {enrollments.items.length === 0 ? (
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
                {enrollments.items.map((enrollment) => (
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
        <div className="pagination">
          <button className="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            className="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </button>
        </div>
      </section>
    </>
  );
}
