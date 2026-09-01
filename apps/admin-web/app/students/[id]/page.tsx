'use client';
import type {
  AttendanceListDto,
  CreateEnrollmentBillingConditionDto,
  EnrollmentBillingConditionDto,
  EnrollmentDto,
  EnrollmentListDto,
  MonthlyChargeListDto,
  PaymentListDto,
  PaymentSummaryDto,
  StudentDto,
} from '@academy/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
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
const adjustmentLabel = {
  DIRECTION_SCHOLARSHIP: 'Beca de Dirección',
  TEACHER_SCHOLARSHIP: 'Beca del profesor',
  TEACHER_DISCOUNT: 'Descuento del profesor',
  LATE_FEE: 'Recargo por mora',
  REVERSAL: 'Corrección',
} as const;

const formatBillingPeriod = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  const formatted = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const conditionExplanation = {
  DIRECTION_SCHOLARSHIP:
    'El alumno no abona esta actividad. El importe sigue siendo reconocido para la futura liquidación docente.',
  TEACHER_SCHOLARSHIP:
    'El alumno no abona esta actividad y este importe no genera reconocimiento para la liquidación docente.',
  TEACHER_DISCOUNT: 'El profesor reduce parcialmente el importe que abona el alumno.',
} as const;

const conditionIsCurrent = (item: EnrollmentBillingConditionDto) =>
  !item.endedAt && (!item.effectiveUntil || item.effectiveUntil >= businessToday().slice(0, 7));
const nextBillingPeriod = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  const next = new Date(Date.UTC(year!, month!, 1));
  return next.toISOString().slice(0, 7);
};

function BillingConditions({
  enrollment,
  canManage,
  isAdministrator,
  onChanged,
}: Readonly<{
  enrollment: EnrollmentDto;
  canManage: boolean;
  isAdministrator: boolean;
  onChanged(): Promise<void>;
}>) {
  const [items, setItems] = useState<readonly EnrollmentBillingConditionDto[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [renewing, setRenewing] = useState<EnrollmentBillingConditionDto | null>(null);
  const [type, setType] = useState<CreateEnrollmentBillingConditionDto['type']>('TEACHER_DISCOUNT');
  const [calculation, setCalculation] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [from, setFrom] = useState(businessToday().slice(0, 7));
  const [until, setUntil] = useState('');
  const [why, setWhy] = useState('');
  const loadConditions = useCallback(async () => {
    try {
      setItems(
        await apiRequest<readonly EnrollmentBillingConditionDto[]>(
          `/enrollments/${enrollment.id}/billing-conditions`,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'No se pudieron cargar los ajustes',
      );
    }
  }, [enrollment.id]);
  useEffect(() => void loadConditions(), [loadConditions]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiRequest(
        renewing
          ? `/billing-conditions/${renewing.id}/renew`
          : `/enrollments/${enrollment.id}/billing-conditions`,
        {
          method: 'POST',
          body: JSON.stringify({
            type,
            ...(type === 'TEACHER_DISCOUNT' ? { calculation, configuredValue: value } : {}),
            effectiveFrom: from,
            ...(until ? { effectiveUntil: until } : {}),
            ...(type !== 'DIRECTION_SCHOLARSHIP'
              ? { teacherId: enrollment.academicClass.teacher.id }
              : {}),
            reason: why,
          }),
        },
      );
      setOpen(false);
      setRenewing(null);
      setWhy('');
      setValue('');
      await Promise.all([loadConditions(), onChanged()]);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo aplicar el ajuste');
    } finally {
      setSaving(false);
    }
  }
  function openCreate() {
    setRenewing(null);
    setType('TEACHER_DISCOUNT');
    setCalculation('PERCENTAGE');
    setValue('');
    setWhy('');
    setOpen(true);
  }
  function openRenew(item: EnrollmentBillingConditionDto) {
    setRenewing(item);
    setType(item.type);
    setCalculation(item.calculation);
    setValue(item.type === 'TEACHER_DISCOUNT' ? String(Number(item.configuredValue)) : '');
    setFrom(
      item.effectiveUntil ? nextBillingPeriod(item.effectiveUntil) : businessToday().slice(0, 7),
    );
    setUntil('');
    setWhy('');
    setOpen(true);
  }
  function closeEditor() {
    setOpen(false);
    setRenewing(null);
  }
  async function end(item: EnrollmentBillingConditionDto) {
    const endReason = window.prompt('Motivo de finalización');
    if (!endReason) return;
    const effectiveUntil = window.prompt(
      'Último período con vigencia (AAAA-MM)',
      item.effectiveFrom,
    );
    if (!effectiveUntil) return;
    try {
      await apiRequest(`/billing-conditions/${item.id}/end`, {
        method: 'POST',
        body: JSON.stringify({ effectiveUntil, reason: endReason }),
      });
      await loadConditions();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo finalizar');
    }
  }
  return (
    <div className="billing-conditions">
      <div className="billing-conditions-heading">
        <div>
          <h4>Condiciones económicas</h4>
          <p>Becas y descuentos aplicados a esta actividad.</p>
        </div>
        {canManage && (
          <button
            className="billing-add-button"
            type="button"
            onClick={open ? closeEditor : openCreate}
          >
            {open ? 'Cancelar' : '+ Agregar beca o descuento'}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="billing-conditions-empty">
          No hay becas ni descuentos vigentes para esta actividad.
        </p>
      ) : (
        <div className="billing-condition-list">
          {items.map((item) => (
            <article className="billing-condition-card" key={item.id}>
              <div className="billing-condition-title">
                <div>
                  <strong>{adjustmentLabel[item.type]}</strong>
                  <span>
                    {item.calculation === 'PERCENTAGE'
                      ? `${Number(item.configuredValue)}%${item.type !== 'TEACHER_DISCOUNT' ? ' de cobertura' : ''}`
                      : money(item.configuredValue)}
                  </span>
                </div>
                <span
                  className={`condition-status ${conditionIsCurrent(item) ? 'current' : 'ended'}`}
                >
                  {conditionIsCurrent(item) ? 'Vigente' : 'Finalizada'}
                </span>
              </div>
              <p className="billing-condition-period">
                {item.effectiveUntil
                  ? `${formatBillingPeriod(item.effectiveFrom)} — ${formatBillingPeriod(item.effectiveUntil)}`
                  : `Vigente desde ${formatBillingPeriod(item.effectiveFrom)}`}
              </p>
              {item.teacher && (
                <p>
                  <span>Profesor</span>
                  <strong>
                    {item.teacher.firstName} {item.teacher.lastName}
                  </strong>
                </p>
              )}
              {canManage &&
                conditionIsCurrent(item) &&
                (item.type !== 'DIRECTION_SCHOLARSHIP' || isAdministrator) && (
                  <div className="billing-condition-actions">
                    {item.effectiveUntil && (
                      <button className="secondary" type="button" onClick={() => openRenew(item)}>
                        Renovar
                      </button>
                    )}
                    <button className="danger-link" type="button" onClick={() => void end(item)}>
                      Finalizar
                    </button>
                  </div>
                )}
            </article>
          ))}
        </div>
      )}
      {open && (
        <form className="billing-condition-form" onSubmit={submit}>
          <div className="billing-form-heading">
            <strong>
              {renewing ? `Renovar ${adjustmentLabel[renewing.type]}` : 'Nueva condición económica'}
            </strong>
            <small>Elegí una beca completa o un descuento parcial.</small>
          </div>
          <fieldset className="condition-options">
            <legend>Tipo de condición</legend>
            {isAdministrator && (
              <label className="condition-option">
                <input
                  type="radio"
                  name="condition-type"
                  value="DIRECTION_SCHOLARSHIP"
                  checked={type === 'DIRECTION_SCHOLARSHIP'}
                  onChange={() => setType('DIRECTION_SCHOLARSHIP')}
                />
                <span>
                  <strong>Beca de Dirección — 100%</strong>
                  <small>{conditionExplanation.DIRECTION_SCHOLARSHIP}</small>
                </span>
              </label>
            )}
            <label className="condition-option">
              <input
                type="radio"
                name="condition-type"
                value="TEACHER_SCHOLARSHIP"
                checked={type === 'TEACHER_SCHOLARSHIP'}
                onChange={() => setType('TEACHER_SCHOLARSHIP')}
              />
              <span>
                <strong>Beca del profesor — 100%</strong>
                <small>{conditionExplanation.TEACHER_SCHOLARSHIP}</small>
              </span>
            </label>
            <label className="condition-option">
              <input
                type="radio"
                name="condition-type"
                value="TEACHER_DISCOUNT"
                checked={type === 'TEACHER_DISCOUNT'}
                onChange={() => setType('TEACHER_DISCOUNT')}
              />
              <span>
                <strong>Descuento del profesor</strong>
                <small>{conditionExplanation.TEACHER_DISCOUNT}</small>
              </span>
            </label>
          </fieldset>
          {type === 'TEACHER_DISCOUNT' && (
            <fieldset className="discount-fields">
              <legend>Tipo de descuento</legend>
              <div className="inline-radio-options">
                <label>
                  <input
                    type="radio"
                    name="discount-type"
                    checked={calculation === 'PERCENTAGE'}
                    onChange={() => setCalculation('PERCENTAGE')}
                  />{' '}
                  Porcentaje
                </label>
                <label>
                  <input
                    type="radio"
                    name="discount-type"
                    checked={calculation === 'FIXED'}
                    onChange={() => setCalculation('FIXED')}
                  />{' '}
                  Monto fijo
                </label>
              </div>
              <label>
                {calculation === 'PERCENTAGE' ? 'Valor' : 'Monto'}
                <span className="amount-input">
                  {calculation === 'FIXED' && <span aria-hidden="true">$</span>}
                  <input
                    required
                    min="0.01"
                    max={calculation === 'PERCENTAGE' ? '100' : undefined}
                    step="0.01"
                    type="number"
                    inputMode="decimal"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  />
                  {calculation === 'PERCENTAGE' && <span aria-hidden="true">%</span>}
                </span>
              </label>
              <small className="field-helper">
                {calculation === 'PERCENTAGE'
                  ? 'Ej.: 50% sobre una cuota de $40.000 reduce $20.000.'
                  : 'Ej.: un monto fijo de $10.000 reduce ese importe de la cuota.'}
              </small>
            </fieldset>
          )}
          {type !== 'TEACHER_DISCOUNT' && (
            <div className="scholarship-coverage">
              <span>Cobertura</span>
              <strong>100%</strong>
              <small>
                Las becas son siempre del 100%. Para una reducción parcial, utilizá Descuento del
                profesor.
              </small>
            </div>
          )}
          <div className="billing-period-fields">
            <label>
              Desde
              <input
                required
                type="month"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              Hasta (opcional)
              <input
                type="month"
                value={until}
                onChange={(event) => setUntil(event.target.value)}
              />
            </label>
          </div>
          <label>
            Motivo
            <textarea
              required
              maxLength={500}
              value={why}
              onChange={(event) => setWhy(event.target.value)}
            />
          </label>
          <div className="billing-form-actions">
            <button className="secondary" type="button" onClick={closeEditor} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}>
              {saving ? 'Aplicando…' : renewing ? 'Renovar condición' : 'Aplicar beca o descuento'}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can, user } = useAuth();
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
                <BillingConditions
                  enrollment={item}
                  canManage={can('charges:manage')}
                  isAdministrator={user.role === 'ADMINISTRATOR'}
                  onChanged={load}
                />
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
                        <td data-label="Importe">
                          {money(charge.studentDueAmount)}
                          {charge.adjustments.length > 0 && (
                            <small className="billing-adjustment-summary">
                              {charge.adjustments
                                .map((item) => adjustmentLabel[item.type])
                                .join(' · ')}
                            </small>
                          )}
                        </td>
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
