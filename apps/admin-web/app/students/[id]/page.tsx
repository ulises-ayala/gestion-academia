'use client';
import type { EnrollmentListDto, MonthlyChargeListDto, StudentDto } from '@academy/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { StudentForm } from '../../../components/student-form';
import { ApiClientError, apiRequest } from '../../../lib/api-client';
import { calculateAge, formatDate } from '../../../lib/dates';
import { dayLabels } from '../../../lib/offering';
const futureSections = ['Pagos', 'Descuentos', 'Asistencias'];
const money = (value: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));
const chargeStatus = { PENDING: 'Pendiente', PAID: 'Pagada', VOID: 'Anulada' } as const;
export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<StudentDto | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentListDto['items']>([]);
  const [charges, setCharges] = useState<MonthlyChargeListDto['items']>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, e, c] = await Promise.all([
        apiRequest<StudentDto>(`/students/${id}`),
        apiRequest<EnrollmentListDto>(`/enrollments?studentId=${id}&pageSize=100`),
        apiRequest<MonthlyChargeListDto>(`/monthly-charges?studentId=${id}`),
      ]);
      setStudent(s);
      setEnrollments(e.items);
      setCharges(c.items);
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cargar el alumno');
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  async function changeStatus() {
    if (!student) return;
    if (student.status === 'ACTIVE' && !confirm('¿Desactivar este alumno?')) return;
    try {
      setStudent(
        await apiRequest<StudentDto>(
          student.status === 'ACTIVE' ? `/students/${id}` : `/students/${id}/reactivate`,
          { method: student.status === 'ACTIVE' ? 'DELETE' : 'POST' },
        ),
      );
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cambiar el estado');
    }
  }
  async function endEnrollment(enrollmentId: string) {
    if (!confirm('¿Finalizar esta inscripción hoy?')) return;
    try {
      await apiRequest(`/enrollments/${enrollmentId}/end`, {
        method: 'POST',
        body: JSON.stringify({ endDate: new Date().toLocaleDateString('en-CA') }),
      });
      await load();
    } catch (error) {
      setMessage(
        error instanceof ApiClientError ? error.message : 'No se pudo finalizar la inscripción',
      );
    }
  }
  if (loading) return <p>Cargando ficha…</p>;
  if (!student)
    return (
      <section className="card">
        <h1>Alumno no disponible</h1>
        <p>{message}</p>
      </section>
    );
  const active = enrollments.filter((item) => item.status === 'ACTIVE');
  const history = enrollments.filter((item) => item.status === 'ENDED');
  return (
    <>
      <div className="page-heading">
        <div>
          <Link className="back-link" href="/students">
            ← Volver
          </Link>
          <p className="eyebrow">Ficha del alumno</p>
          <h1>
            {student.firstName} {student.lastName}
          </h1>
        </div>
        <div className="actions">
          {student.status === 'ACTIVE' && (
            <Link className="button" href={`/students/${id}/enrollments/new`}>
              Inscribir en clase
            </Link>
          )}
          <button className="secondary" onClick={() => setEditing(!editing)}>
            Editar
          </button>
          <button onClick={() => void changeStatus()}>
            {student.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}
          </button>
        </div>
      </div>
      {message && <p className="message">{message}</p>}
      {editing && (
        <section className="card">
          <StudentForm
            student={student}
            onSaved={(value) => {
              setStudent(value);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </section>
      )}
      <section className="card">
        <h2>Datos personales</h2>
        <dl className="detail-grid">
          <div>
            <dt>DNI</dt>
            <dd>{student.dni}</dd>
          </div>
          <div>
            <dt>Edad</dt>
            <dd>{calculateAge(student.birthDate) ?? '—'}</dd>
          </div>
          <div>
            <dt>Nacimiento</dt>
            <dd>{formatDate(student.birthDate)}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>{student.phone ?? '—'}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{student.email ?? '—'}</dd>
          </div>
          <div>
            <dt>Alta</dt>
            <dd>{formatDate(student.joinedAt)}</dd>
          </div>
        </dl>
      </section>
      <section className="card">
        <h2>Clases actuales ({active.length})</h2>
        {active.length === 0 ? (
          <p className="empty-state">No tiene inscripciones activas.</p>
        ) : (
          <div className="enrollment-grid">
            {active.map((item) => (
              <article className="enrollment-card" key={item.id}>
                <h3>{item.academicClass.name}</h3>
                <p>
                  {item.academicClass.danceType.name} · {item.academicClass.teacher.firstName}{' '}
                  {item.academicClass.teacher.lastName}
                </p>
                <ul className="schedule-list">
                  {item.academicClass.schedules.map((s) => (
                    <li key={s.id}>
                      {dayLabels[s.dayOfWeek]} {s.startTime}–{s.endTime}
                      <br />
                      {s.room.branch.name} · {s.room.name}
                    </li>
                  ))}
                </ul>
                <p>Inscripto desde: {formatDate(item.startDate)}</p>
                <button className="secondary" onClick={() => void endEnrollment(item.id)}>
                  Finalizar inscripción
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="card">
        <h2>Cuotas</h2>
        {charges.length === 0 ? (
          <p className="empty-state">Todavía no hay cuotas generadas.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Clase</th>
                  <th>Monto</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((charge) => (
                  <tr key={charge.id}>
                    <td>{charge.period}</td>
                    <td>{charge.academicClass.name}</td>
                    <td>{money(charge.finalAmount)}</td>
                    <td>{formatDate(charge.dueDate)}</td>
                    <td>{chargeStatus[charge.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card">
        <h2>Historial de clases</h2>
        {history.length === 0 ? (
          <p className="empty-state">Todavía no hay inscripciones finalizadas.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Clase</th>
                  <th>Profesor</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.academicClass.name}</td>
                    <td>
                      {item.academicClass.teacher.firstName} {item.academicClass.teacher.lastName}
                    </td>
                    <td>{formatDate(item.startDate)}</td>
                    <td>{formatDate(item.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="future-grid">
        {futureSections.map((section) => (
          <article className="card future-card" key={section}>
            <h2>{section}</h2>
            <p>Esta sección se habilitará en una etapa futura.</p>
          </article>
        ))}
      </section>
    </>
  );
}
