'use client';
import type {
  AttendanceListDto,
  EnrollmentDto,
  EnrollmentListDto,
  MonthlyChargeListDto,
  PaymentListDto,
  PaymentSummaryDto,
  StudentDto,
} from '@academy/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StudentForm } from '../../../components/student-form';
import { useAuth } from '../../../components/auth-provider';
import { ApiClientError, apiRequest } from '../../../lib/api-client';
import { businessToday, calculateAge, formatDate } from '../../../lib/dates';
import { dayLabels } from '../../../lib/offering';
import {
  attendanceCounts,
  isOverdueCharge,
  sortAccountCharges,
  studentAccountSummary,
} from '../../../lib/student-account';
import { paymentMethodLabels } from '../../../lib/payments';

const money = (value: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));
const attendanceStatus = {
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  JUSTIFIED: 'Justificada',
} as const;
const chargeStatus = {
  PENDING: 'Pendiente',
  PARTIAL: 'Pago parcial',
  PAID: 'Pagada',
  VOID: 'Anulada',
} as const;
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Buenos_Aires',
  }).format(new Date(value));

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const [student, setStudent] = useState<StudentDto | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentListDto['items']>([]);
  const [charges, setCharges] = useState<MonthlyChargeListDto['items']>([]);
  const [payments, setPayments] = useState<PaymentListDto['items']>([]);
  const [paymentTotal, setPaymentTotal] = useState('0.00');
  const [attendances, setAttendances] = useState<AttendanceListDto['items']>([]);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [endTarget, setEndTarget] = useState<EnrollmentDto | null>(null);
  const [endDate, setEndDate] = useState('');
  const [statusConfirmation, setStatusConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    setSectionErrors({});
    try {
      const loadedStudent = await apiRequest<StudentDto>(`/students/${id}`);
      setStudent(loadedStudent);
      const requests = await Promise.allSettled([
        apiRequest<EnrollmentListDto>(`/enrollments?studentId=${id}&pageSize=100`),
        apiRequest<MonthlyChargeListDto>(`/monthly-charges?studentId=${id}`),
        apiRequest<PaymentListDto>(`/payments?studentId=${id}&pageSize=10`),
        apiRequest<AttendanceListDto>(`/attendances?studentId=${id}&limit=10`),
        apiRequest<PaymentSummaryDto>(`/payments/summary?studentId=${id}`),
      ]);
      const errors: Record<string, string> = {};
      if (requests[0].status === 'fulfilled') setEnrollments(requests[0].value.items);
      else errors.enrollments = 'No se pudieron cargar las inscripciones.';
      if (requests[1].status === 'fulfilled') setCharges(requests[1].value.items);
      else errors.charges = 'No se pudo cargar el estado de cuenta.';
      if (requests[2].status === 'fulfilled') setPayments(requests[2].value.items);
      else errors.payments = 'No se pudieron cargar los pagos.';
      if (requests[3].status === 'fulfilled') setAttendances(requests[3].value.items);
      else errors.attendances = 'No se pudo cargar la asistencia.';
      if (requests[4].status === 'fulfilled') setPaymentTotal(requests[4].value.confirmedTotal);
      else errors.payments = 'No se pudieron cargar los pagos.';
      setSectionErrors(errors);
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cargar el alumno');
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!endTarget && !statusConfirmation) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        setEndTarget(null);
        setStatusConfirmation(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [endTarget, statusConfirmation, submitting]);

  const today = businessToday();
  const active = enrollments.filter((item) => item.status === 'ACTIVE');
  const history = enrollments.filter((item) => item.status === 'ENDED');
  const orderedCharges = useMemo(() => sortAccountCharges(charges, today), [charges, today]);
  const summary = useMemo(
    () => studentAccountSummary(enrollments, charges, paymentTotal, today),
    [enrollments, charges, paymentTotal, today],
  );
  const attendanceSummary = useMemo(() => attendanceCounts(attendances), [attendances]);
  const classByEnrollment = new Map(enrollments.map((item) => [item.id, item.academicClass.name]));

  async function changeStatus() {
    if (!student || submitting) return;
    setSubmitting(true);
    try {
      setStudent(
        await apiRequest<StudentDto>(
          student.status === 'ACTIVE' ? `/students/${id}` : `/students/${id}/reactivate`,
          { method: student.status === 'ACTIVE' ? 'DELETE' : 'POST' },
        ),
      );
      setStatusConfirmation(false);
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cambiar el estado');
    } finally {
      setSubmitting(false);
    }
  }
  async function endEnrollment() {
    if (!endTarget || !endDate || submitting) return;
    setSubmitting(true);
    try {
      await apiRequest(`/enrollments/${endTarget.id}/end`, {
        method: 'POST',
        body: JSON.stringify({ endDate }),
      });
      setEndTarget(null);
      await load();
    } catch (error) {
      setMessage(
        error instanceof ApiClientError ? error.message : 'No se pudo finalizar la inscripción',
      );
    } finally {
      setSubmitting(false);
    }
  }
  const openEnd = (item: EnrollmentDto) => {
    setEndTarget(item);
    setEndDate(today);
  };

  if (loading)
    return (
      <section className="card student-loading" role="status">
        Cargando ficha integral…
      </section>
    );
  if (!student)
    return (
      <section className="card">
        <h1>Alumno no disponible</h1>
        <p>{message}</p>
      </section>
    );
  return (
    <>
      <div className="student-profile-heading">
        <div>
          <Link className="back-link" href="/students">
            ← Volver
          </Link>
          <p className="eyebrow">Ficha integral del alumno</p>
          <div className="student-title-row">
            <h1>
              {student.firstName} {student.lastName}
            </h1>
            <span className={`status ${student.status.toLowerCase()}`}>
              {student.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="subtitle">DNI {student.dni}</p>
        </div>
        <div className="student-primary-actions">
          {can('enrollments:manage') && student.status === 'ACTIVE' && (
            <Link className="button" href={`/students/${id}/enrollments/new`}>
              Inscribir a otra clase
            </Link>
          )}
          {can('payments:collect') &&
            charges.some((item) => item.status === 'PENDING' || item.status === 'PARTIAL') && (
              <Link className="button" href={`/payments?studentId=${id}`}>
                Registrar pago
              </Link>
            )}
          {can('students:manage') && (
            <button className="secondary" onClick={() => setEditing((value) => !value)}>
              Editar
            </button>
          )}
          {can('students:manage') && (
            <button
              className={student.status === 'ACTIVE' ? 'danger-link' : 'secondary'}
              onClick={() =>
                student.status === 'ACTIVE' ? setStatusConfirmation(true) : void changeStatus()
              }
            >
              {student.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}
            </button>
          )}
        </div>
      </div>
      {message && (
        <p className="message" role="alert">
          {message}
        </p>
      )}
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

      <section aria-labelledby="summary-title">
        <h2 className="section-title" id="summary-title">
          Resumen
        </h2>
        <div className="student-metrics">
          <article className="card">
            <span>Clases activas</span>
            <strong>{summary.activeClasses}</strong>
          </article>
          <article className="card">
            <span>Deuda pendiente</span>
            <strong>
              {summary.pendingDebt === '0.00' ? 'Sin deuda pendiente.' : money(summary.pendingDebt)}
            </strong>
          </article>
          <article className="card">
            <span>Cuotas vencidas</span>
            <strong>{summary.overdueCharges}</strong>
          </article>
          <article className="card">
            <span>Total pagado</span>
            <strong>{money(summary.totalPaid)}</strong>
          </article>
        </div>
      </section>

      <section className="card">
        <h2>Clases actuales</h2>
        {sectionErrors.enrollments ? (
          <p className="message">{sectionErrors.enrollments}</p>
        ) : active.length === 0 ? (
          <p className="empty-state">No tiene clases activas.</p>
        ) : (
          <div className="enrollment-grid">
            {active.map((item) => (
              <article className="enrollment-card" key={item.id}>
                <h3>{item.academicClass.name}</h3>
                <p>
                  {item.academicClass.danceType.name}
                  {item.academicClass.level ? ` · ${item.academicClass.level}` : ''}
                </p>
                <p>
                  Profesor: {item.academicClass.teacher.firstName}{' '}
                  {item.academicClass.teacher.lastName}
                </p>
                <ul className="schedule-list">
                  {item.academicClass.schedules.map((schedule) => (
                    <li key={schedule.id}>
                      {dayLabels[schedule.dayOfWeek]} {schedule.startTime}–{schedule.endTime}
                      <br />
                      {schedule.room.branch.name} · {schedule.room.name}
                    </li>
                  ))}
                </ul>
                <p>Desde {formatDate(item.startDate)}</p>
                {can('enrollments:manage') && (
                  <button className="secondary" onClick={() => openEnd(item)}>
                    Finalizar inscripción
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {can('charges:read') && (
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Estado de cuenta</h2>
              <p className="subtitle">
                {summary.pendingDebt === '0.00'
                  ? 'Sin deuda pendiente.'
                  : `Deuda pendiente: ${money(summary.pendingDebt)}`}
              </p>
            </div>
            {can('payments:collect') &&
              charges.some((item) => item.status === 'PENDING' || item.status === 'PARTIAL') && (
                <Link className="button" href={`/payments?studentId=${id}`}>
                  Registrar pago
                </Link>
              )}
          </div>
          {sectionErrors.charges ? (
            <p className="message">{sectionErrors.charges}</p>
          ) : orderedCharges.length === 0 ? (
            <p className="empty-state">No tiene cuotas registradas.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Clase</th>
                    <th>Importe</th>
                    <th>Pagado</th>
                    <th>Saldo</th>
                    <th>Vencimiento</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedCharges.map((charge) => {
                    const overdue = isOverdueCharge(charge, today);
                    return (
                      <tr key={charge.id}>
                        <td data-label="Período">{charge.period}</td>
                        <td data-label="Clase">{charge.academicClass.name}</td>
                        <td data-label="Importe">{money(charge.finalAmount)}</td>
                        <td data-label="Pagado">{money(charge.paidAmount)}</td>
                        <td data-label="Saldo">{money(charge.outstandingAmount)}</td>
                        <td data-label="Vencimiento">{formatDate(charge.dueDate)}</td>
                        <td data-label="Estado">
                          <span className={`status ${charge.status.toLowerCase()}`}>
                            {chargeStatus[charge.status]}
                          </span>
                          {overdue && <span className="status void">Vencida</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {can('payments:read') && (
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Pagos recientes</h2>
              <p className="subtitle">Últimos movimientos registrados.</p>
            </div>
            <Link className="button secondary" href={`/payments?studentId=${id}`}>
              Ver todos
            </Link>
          </div>
          {sectionErrors.payments ? (
            <p className="message">{sectionErrors.payments}</p>
          ) : payments.length === 0 ? (
            <p className="empty-state">No hay pagos registrados.</p>
          ) : (
            <div className="student-payment-list">
              {payments.map((payment) => (
                <article key={payment.id}>
                  <div>
                    <strong>{money(payment.amount)}</strong>
                    <span>
                      {dateTime(payment.paidAt)} ·{' '}
                      {payment.tenders
                        .map(
                          (tender) =>
                            `${paymentMethodLabels[tender.method]} ${money(tender.amount)}`,
                        )
                        .join(' + ')}
                    </span>
                  </div>
                  <div>
                    <span>
                      {payment.allocations
                        .map(
                          (allocation) =>
                            `${allocation.academicClass.name} ${allocation.period}: ${money(allocation.amount)}`,
                        )
                        .join(', ')}
                    </span>
                    <small>Registrado por {payment.createdBy.username}</small>
                  </div>
                  <span className={`status ${payment.status === 'CONFIRMED' ? 'active' : 'void'}`}>
                    {payment.status === 'CONFIRMED' ? 'Confirmado' : 'Anulado'}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {can('attendance:manage') && (
        <section className="card">
          <h2>Asistencia reciente</h2>
          <div className="attendance-summary">
            <span>
              Presentes <strong>{attendanceSummary.present}</strong>
            </span>
            <span>
              Ausentes <strong>{attendanceSummary.absent}</strong>
            </span>
            <span>
              Justificadas <strong>{attendanceSummary.justified}</strong>
            </span>
          </div>
          {sectionErrors.attendances ? (
            <p className="message">{sectionErrors.attendances}</p>
          ) : attendances.length === 0 ? (
            <p className="empty-state">No hay asistencias registradas.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Clase</th>
                    <th>Estado</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {attendances.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Fecha">{formatDate(item.attendanceDate)}</td>
                      <td data-label="Clase">
                        {classByEnrollment.get(item.enrollmentId) ?? 'Clase'}
                      </td>
                      <td data-label="Estado">{attendanceStatus[item.status]}</td>
                      <td data-label="Observaciones">{item.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h2>Historial de inscripciones</h2>
        {history.length === 0 ? (
          <p className="empty-state">No hay inscripciones finalizadas.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Clase</th>
                  <th>Inicio</th>
                  <th>Finalización</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Clase">{item.academicClass.name}</td>
                    <td data-label="Inicio">{formatDate(item.startDate)}</td>
                    <td data-label="Finalización">{formatDate(item.endDate)}</td>
                    <td data-label="Estado">
                      <span className="status inactive">Finalizada</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
            <dt>Domicilio</dt>
            <dd>{student.address ?? '—'}</dd>
          </div>
          <div>
            <dt>Fecha de alta</dt>
            <dd>{formatDate(student.joinedAt)}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{student.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</dd>
          </div>
        </dl>
      </section>
      {endTarget && (
        <div className="modal-backdrop">
          <section
            aria-labelledby="end-title"
            aria-modal="true"
            className="modal card"
            role="dialog"
          >
            <h2 id="end-title">Finalizar inscripción</h2>
            <p>
              ¿Querés finalizar la inscripción de {student.firstName} {student.lastName} en{' '}
              <strong>{endTarget.academicClass.name}</strong>?
            </p>
            <label>
              Fecha de finalización
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
            <p className="modal-note neutral">La inscripción quedará conservada en el historial.</p>
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={submitting}
                onClick={() => setEndTarget(null)}
              >
                Cancelar
              </button>
              <button disabled={!endDate || submitting} onClick={() => void endEnrollment()}>
                {submitting ? 'Finalizando…' : 'Finalizar inscripción'}
              </button>
            </div>
          </section>
        </div>
      )}
      {statusConfirmation && (
        <div className="modal-backdrop">
          <section
            aria-labelledby="status-title"
            aria-modal="true"
            className="modal card"
            role="dialog"
          >
            <h2 id="status-title">Desactivar alumno</h2>
            <p>
              ¿Querés desactivar a {student.firstName} {student.lastName}?
            </p>
            <p className="modal-note">El alumno conservará toda su información e historial.</p>
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={submitting}
                onClick={() => setStatusConfirmation(false)}
              >
                Cancelar
              </button>
              <button
                className="danger-button"
                disabled={submitting}
                onClick={() => void changeStatus()}
              >
                {submitting ? 'Desactivando…' : 'Desactivar'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
