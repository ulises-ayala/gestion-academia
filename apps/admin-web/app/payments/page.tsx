'use client';

import type {
  MonthlyChargeListDto,
  PaymentDto,
  PaymentListDto,
  ReceivablesDto,
  StudentDto,
  StudentListDto,
} from '@academy/contracts';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/auth-provider';
import { PermissionGate } from '../../components/permission-gate';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { paymentViewFromSearch } from '../../lib/contextual-filters';
import { formatDate } from '../../lib/dates';
import {
  centsToDecimal,
  createPaymentPayload,
  decimalToCents,
  openCharges,
  outstandingTotal,
  paymentSubmissionDisabled,
  paymentMethodLabels,
  previewAllocations,
  tenderTotal,
  type TenderAmounts,
} from '../../lib/payments';

const money = (value: string | number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Buenos_Aires',
  }).format(new Date(value));
const emptyTenders = (): TenderAmounts => ({ CASH: '', MERCADO_PAGO: '', CARD: '' });

export default function PaymentsPage() {
  const { can } = useAuth();
  const [view] = useState<'' | 'pending' | 'overdue'>(() =>
    typeof window === 'undefined' ? '' : paymentViewFromSearch(window.location.search),
  );
  const [receivables, setReceivables] = useState<ReceivablesDto | null>(null);
  const [receivablesPage, setReceivablesPage] = useState(1);
  const [receivablesLoading, setReceivablesLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly StudentDto[]>([]);
  const [student, setStudent] = useState<StudentDto | null>(null);
  const [charges, setCharges] = useState<MonthlyChargeListDto['items']>([]);
  const [payments, setPayments] = useState<PaymentListDto['items']>([]);
  const [tenders, setTenders] = useState<TenderAmounts>(emptyTenders);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voidTarget, setVoidTarget] = useState<PaymentDto | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  const loadStudent = useCallback(async (selectedStudent: StudentDto) => {
    setStudent(selectedStudent);
    setTenders(emptyTenders());
    setMessage('');
    const [chargeResult, paymentResult] = await Promise.all([
      apiRequest<MonthlyChargeListDto>(`/monthly-charges?studentId=${selectedStudent.id}`),
      apiRequest<PaymentListDto>(`/payments?studentId=${selectedStudent.id}&pageSize=100`),
    ]);
    setCharges(chargeResult.items);
    setPayments(paymentResult.items);
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('studentId');
    if (id)
      void apiRequest<StudentDto>(`/students/${id}`)
        .then(loadStudent)
        .catch(() => setMessage('No se pudo seleccionar el alumno indicado.'));
  }, [loadStudent]);

  useEffect(() => {
    if (!view) return;
    setReceivablesLoading(true);
    void apiRequest<ReceivablesDto>(
      `/payments/receivables?scope=${view}&page=${receivablesPage}&pageSize=20`,
    )
      .then(setReceivables)
      .catch((error) =>
        setMessage(
          error instanceof ApiClientError
            ? error.message
            : 'No se pudieron cargar las cuentas pendientes.',
        ),
      )
      .finally(() => setReceivablesLoading(false));
  }, [receivablesPage, view]);

  useEffect(() => {
    if (!voidTarget) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !voiding) setVoidTarget(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [voidTarget, voiding]);

  async function search(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!query.trim()) return setResults([]);
    try {
      const result = await apiRequest<StudentListDto>(
        `/students?q=${encodeURIComponent(query.trim())}&pageSize=10`,
      );
      setResults(result.items);
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo buscar alumnos');
    }
  }

  const pending = useMemo(() => openCharges(charges), [charges]);
  const totalCents = useMemo(() => tenderTotal(tenders), [tenders]);
  const debtCents = useMemo(() => decimalToCents(outstandingTotal(charges)) ?? 0n, [charges]);
  const allocationPreview = useMemo(
    () => previewAllocations(charges, totalCents),
    [charges, totalCents],
  );
  const hasInvalidTender = Object.values(tenders).some(
    (amount) => amount.trim() !== '' && decimalToCents(amount) === null,
  );
  const exceedsOutstanding = totalCents > debtCents;

  async function collect() {
    if (!student || submitting) return;
    setSubmitting(true);
    setMessage('');
    try {
      await apiRequest<PaymentDto>('/payments', {
        method: 'POST',
        body: JSON.stringify(createPaymentPayload(student.id, tenders)),
      });
      await loadStudent(student);
      setMessage('Pago registrado correctamente.');
    } catch (error) {
      const changed =
        error instanceof ApiClientError &&
        (error.status === 409 || error.error.code === 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE');
      await loadStudent(student).catch(() => undefined);
      setMessage(
        changed
          ? 'La deuda cambió mientras registrabas el pago. Actualizamos el estado de cuenta para que puedas revisarlo nuevamente.'
          : error instanceof ApiClientError
            ? error.message
            : 'No se pudo registrar el pago',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function voidPayment() {
    if (!voidTarget || !voidReason.trim() || voiding) return;
    setVoiding(true);
    try {
      await apiRequest(`/payments/${voidTarget.id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      setVoidTarget(null);
      setVoidReason('');
      if (student) await loadStudent(student);
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo anular el pago');
    } finally {
      setVoiding(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Facturación</p>
          <h1>
            {view === 'overdue'
              ? 'Cuotas vencidas'
              : view === 'pending'
                ? 'Cuentas pendientes'
                : 'Pagos'}
          </h1>
          <p className="subtitle">
            {view
              ? 'Mostrando alumnos con cuotas pendientes según el filtro activo.'
              : 'Pagos parciales, medios combinados e historial financiero.'}
          </p>
        </div>
      </div>

      {view && (
        <section className="card receivables-card">
          <div className="context-filter">
            <span>
              Filtro activo: <strong>{view === 'overdue' ? 'Vencidas' : 'Pendientes'}</strong>
            </span>
            <Link href="/payments">Limpiar filtro</Link>
          </div>
          {receivablesLoading ? (
            <p>Cargando cuentas pendientes…</p>
          ) : receivables && receivables.items.length > 0 ? (
            <>
              <div className="receivables-summary">
                <span>
                  <strong>{receivables.totalCharges}</strong> cuotas
                </span>
                <span>
                  <strong>{receivables.totalStudents}</strong> alumnos
                </span>
                <span>
                  <strong>{money(receivables.totalAmount)}</strong> total pendiente
                </span>
              </div>
              <div className="debtor-list">
                {receivables.items.map((debtor) => (
                  <article className="debtor-row" key={debtor.student.id}>
                    <div>
                      <h3>
                        {debtor.student.firstName} {debtor.student.lastName}
                      </h3>
                      <p>
                        DNI {debtor.student.dni} · {debtor.pendingCount} cuotas abiertas
                      </p>
                      <small>Más antigua: {formatDate(debtor.oldestDueDate)}</small>
                    </div>
                    <strong>{money(debtor.totalPending)}</strong>
                    <div className="debtor-actions">
                      <Link className="button secondary" href={`/students/${debtor.student.id}`}>
                        Ver ficha
                      </Link>
                      {can('payments:collect') && (
                        <Link className="button" href={`/payments?studentId=${debtor.student.id}`}>
                          Cobrar
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <div className="pagination">
                <button
                  className="secondary"
                  disabled={receivablesPage <= 1 || receivablesLoading}
                  onClick={() => setReceivablesPage((value) => value - 1)}
                >
                  Anterior
                </button>
                <span>
                  Página {receivables.page} de{' '}
                  {Math.max(1, Math.ceil(receivables.totalStudents / receivables.pageSize))}
                </span>
                <button
                  className="secondary"
                  disabled={
                    receivablesPage * receivables.pageSize >= receivables.totalStudents ||
                    receivablesLoading
                  }
                  onClick={() => setReceivablesPage((value) => value + 1)}
                >
                  Siguiente
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h2>
                {view === 'overdue' ? 'No hay cuotas vencidas.' : 'No hay cuentas pendientes.'}
              </h2>
              <p>El filtro no encontró alumnos con deuda.</p>
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h2>Buscar alumno</h2>
        <form className="filters" onSubmit={search}>
          <label className="search-field">
            DNI o nombre
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar alumno"
            />
          </label>
          <button>Buscar</button>
        </form>
        {results.length > 0 && (
          <div className="selection-list">
            {results.map((item) => (
              <button
                className="secondary"
                key={item.id}
                onClick={() => void loadStudent(item)}
                type="button"
              >
                <strong>
                  {item.lastName}, {item.firstName}
                </strong>{' '}
                · DNI {item.dni}
              </button>
            ))}
          </div>
        )}
        {message && (
          <p className="message" role="alert">
            {message}
          </p>
        )}
      </section>

      {student && (
        <>
          <section className="card">
            <p className="eyebrow">Alumno seleccionado</p>
            <h2>
              {student.firstName} {student.lastName}
            </h2>
            <p>DNI {student.dni}</p>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Estado de cuenta</h2>
                <p className="subtitle">
                  La imputación se realiza primero sobre la cuota más antigua.
                </p>
              </div>
              <strong>Saldo pendiente: {money(outstandingTotal(charges))}</strong>
            </div>
            {charges.length === 0 ? (
              <p className="empty-state">No hay cuotas registradas para este alumno.</p>
            ) : pending.length === 0 ? (
              <p className="empty-state">Este alumno no tiene cuotas pendientes.</p>
            ) : (
              <div className="payment-charge-list">
                {pending.map((charge) => (
                  <article className="enrollment-card" key={charge.id}>
                    <span>
                      <strong>{charge.academicClass.name}</strong>
                      <br />
                      {charge.period} · vence {formatDate(charge.dueDate)}{' '}
                      {charge.overdue && <span className="status void">Vencida</span>}{' '}
                      <span className={`status ${charge.status.toLowerCase()}`}>
                        {charge.status === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                      </span>
                    </span>
                    <span>
                      <small>Importe {money(charge.finalAmount)}</small>
                      <br />
                      <small>Pagado {money(charge.paidAmount)}</small>
                      <br />
                      <strong>Resta {money(charge.outstandingAmount)}</strong>
                    </span>
                  </article>
                ))}
              </div>
            )}

            {pending.length > 0 && (
              <div className="payment-v2-grid">
                <div className="payment-tenders">
                  <h3>Registrar cobro</h3>
                  <p className="subtitle">Ingresá el importe recibido por cada medio.</p>
                  {(Object.entries(paymentMethodLabels) as [keyof TenderAmounts, string][]).map(
                    ([method, label]) => (
                      <label key={method}>
                        {label}
                        <input
                          inputMode="decimal"
                          placeholder="0,00"
                          value={tenders[method]}
                          onChange={(event) =>
                            setTenders((current) => ({ ...current, [method]: event.target.value }))
                          }
                        />
                      </label>
                    ),
                  )}
                  <strong>Total del pago: {money(centsToDecimal(totalCents))}</strong>
                  {hasInvalidTender && (
                    <p className="field-error">Usá importes positivos con hasta dos decimales.</p>
                  )}
                  {exceedsOutstanding && (
                    <p className="field-error">El pago no puede superar el saldo pendiente.</p>
                  )}
                </div>
                <div className="payment-allocation-preview">
                  <h3>Vista previa de imputación</h3>
                  {allocationPreview.length === 0 ? (
                    <p className="subtitle">Ingresá un importe para ver cómo se distribuirá.</p>
                  ) : (
                    <>
                      <ul>
                        {allocationPreview.map(({ charge, amount }) => (
                          <li key={charge.id}>
                            <span>
                              {charge.academicClass.name} · {charge.period}
                            </span>
                            <strong>{money(amount)}</strong>
                          </li>
                        ))}
                      </ul>
                      {!exceedsOutstanding && (
                        <strong>
                          Saldo posterior estimado: {money(centsToDecimal(debtCents - totalCents))}
                        </strong>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            {pending.length > 0 && (
              <div className="payment-summary">
                <button
                  disabled={paymentSubmissionDisabled(
                    totalCents,
                    debtCents,
                    hasInvalidTender,
                    submitting,
                  )}
                  onClick={() => void collect()}
                >
                  {submitting ? 'Registrando…' : 'Registrar cobro'}
                </button>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Historial</h2>
            {payments.length === 0 ? (
              <p className="empty-state">No hay pagos registrados.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Imputación</th>
                      <th>Medios</th>
                      <th>Importe</th>
                      <th>Registrado por</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td data-label="Fecha">{dateTime(payment.paidAt)}</td>
                        <td data-label="Imputación">
                          {payment.allocations
                            .map(
                              (allocation) =>
                                `${allocation.academicClass.name} ${allocation.period}: ${money(allocation.amount)}`,
                            )
                            .join(', ')}
                        </td>
                        <td data-label="Medios">
                          {payment.tenders
                            .map(
                              (tender) =>
                                `${paymentMethodLabels[tender.method]}: ${money(tender.amount)}`,
                            )
                            .join(', ')}
                        </td>
                        <td data-label="Importe">{money(payment.amount)}</td>
                        <td data-label="Registrado por">{payment.createdBy.username}</td>
                        <td data-label="Estado">
                          <span
                            className={`status ${payment.status === 'CONFIRMED' ? 'active' : 'void'}`}
                          >
                            {payment.status === 'CONFIRMED' ? 'Confirmado' : 'Anulado'}
                          </span>
                        </td>
                        <td data-label="Acciones">
                          <PermissionGate permission="payments:void">
                            {payment.status === 'CONFIRMED' && (
                              <button
                                className="secondary"
                                onClick={() => {
                                  setVoidTarget(payment);
                                  setVoidReason('');
                                }}
                              >
                                Anular
                              </button>
                            )}
                          </PermissionGate>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {voidTarget && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !voiding) setVoidTarget(null);
          }}
        >
          <section
            aria-labelledby="void-title"
            aria-modal="true"
            className="modal card"
            role="dialog"
          >
            <h2 id="void-title">Anular pago</h2>
            <p className="modal-copy">Indicá por qué necesitás anular este pago.</p>
            <label>
              Motivo
              <textarea
                autoFocus
                maxLength={500}
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                placeholder="Pago registrado por error"
              />
            </label>
            <p className="modal-note">
              El pago, sus medios y sus imputaciones se conservarán. El saldo de cada cuota se
              recalculará con los demás pagos confirmados.
            </p>
            <div className="modal-actions">
              <button className="secondary" disabled={voiding} onClick={() => setVoidTarget(null)}>
                Cancelar
              </button>
              <button
                className="danger-button"
                disabled={!voidReason.trim() || voiding}
                onClick={() => void voidPayment()}
              >
                {voiding ? 'Anulando…' : 'Anular pago'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
