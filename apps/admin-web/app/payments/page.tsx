'use client';

import type {
  MonthlyChargeListDto,
  PaymentDto,
  PaymentListDto,
  PaymentMethodDto,
  PaymentStatusDto,
  ReceivablesDto,
  ReceivablesScopeDto,
  ReceivablesSortDto,
  StudentDto,
  StudentListDto,
} from '@academy/contracts';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../components/auth-provider';
import { PaymentHistory } from '../../components/payment-history';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { formatDate } from '../../lib/dates';
import {
  paymentBackHref,
  paymentLocationFromSearch,
  paymentSearch,
} from '../../lib/payment-center';
import { cashHrefForPayment } from '../../lib/contextual-filters';
import {
  centsToDecimal,
  createPaymentPayload,
  decimalToCents,
  openCharges,
  outstandingTotal,
  paymentMethodLabels,
  paymentSubmissionDisabled,
  previewAllocations,
  tenderTotal,
  type TenderAmounts,
} from '../../lib/payments';

const money = (value: string | number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));
const emptyTenders = (): TenderAmounts => ({ CASH: '', MERCADO_PAGO: '', CARD: '' });
const scopeLabels: Readonly<Record<ReceivablesScopeDto, string>> = {
  pending: 'Todas con saldo',
  overdue: 'Vencidas',
  partial: 'Parciales',
  unpaid: 'Sin pagos',
};
const emptyByScope: Readonly<Record<ReceivablesScopeDto, string>> = {
  pending: 'No hay cuentas pendientes.',
  overdue: 'No hay cuotas vencidas.',
  partial: 'No hay cuotas parcialmente abonadas.',
  unpaid: 'No hay cuotas pendientes sin pagos.',
};
const loadingByScope: Readonly<Record<ReceivablesScopeDto, string>> = {
  pending: 'Cargando cuentas pendientes…',
  overdue: 'Cargando cuotas vencidas…',
  partial: 'Cargando cuotas parcialmente abonadas…',
  unpaid: 'Cargando cuotas sin pagos…',
};

export default function PaymentsPage() {
  const { can } = useAuth();
  const [locationSearch, setLocationSearch] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.search,
  );
  const location = useMemo(() => paymentLocationFromSearch(locationSearch), [locationSearch]);
  const [receivables, setReceivables] = useState<ReceivablesDto | null>(null);
  const [receivablesLoading, setReceivablesLoading] = useState(false);
  const [receivablesError, setReceivablesError] = useState('');
  const [accountQ, setAccountQ] = useState(location.q);
  const [accountSort, setAccountSort] = useState<ReceivablesSortDto>(location.sort);
  const [history, setHistory] = useState<PaymentListDto | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyQ, setHistoryQ] = useState(location.historyQ);
  const [historyStatus, setHistoryStatus] = useState<'' | PaymentStatusDto>(location.paymentStatus);
  const [historyMethod, setHistoryMethod] = useState<'' | PaymentMethodDto>(location.paymentMethod);
  const [historyFrom, setHistoryFrom] = useState(location.from);
  const [historyTo, setHistoryTo] = useState(location.to);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly StudentDto[]>([]);
  const [student, setStudent] = useState<StudentDto | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [charges, setCharges] = useState<MonthlyChargeListDto['items']>([]);
  const [payments, setPayments] = useState<PaymentListDto['items']>([]);
  const [tenders, setTenders] = useState<TenderAmounts>(emptyTenders);
  const [message, setMessage] = useState('');
  const [cashShiftRequired, setCashShiftRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voidTarget, setVoidTarget] = useState<PaymentDto | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  const navigate = useCallback((href: string) => {
    const url = new URL(href, window.location.origin);
    window.history.pushState({}, '', url);
    setLocationSearch(url.search);
  }, []);

  useEffect(() => {
    const onPopState = () => setLocationSearch(window.location.search);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    setAccountQ(location.q);
    setAccountSort(location.sort);
    setHistoryQ(location.historyQ);
    setHistoryStatus(location.paymentStatus);
    setHistoryMethod(location.paymentMethod);
    setHistoryFrom(location.from);
    setHistoryTo(location.to);
  }, [location]);

  const loadReceivables = useCallback(async () => {
    setReceivablesLoading(true);
    setReceivablesError('');
    const params = new URLSearchParams({
      scope: location.scope,
      sort: location.sort,
      page: String(location.page),
      pageSize: '25',
    });
    if (location.q) params.set('q', location.q);
    try {
      setReceivables(await apiRequest<ReceivablesDto>(`/payments/receivables?${params}`));
    } catch (error) {
      setReceivablesError(
        error instanceof ApiClientError
          ? error.message
          : 'No se pudieron cargar las cuentas por cobrar.',
      );
    } finally {
      setReceivablesLoading(false);
    }
  }, [location.page, location.q, location.scope, location.sort]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    const params = new URLSearchParams({
      page: String(location.historyPage),
      pageSize: '25',
    });
    if (location.historyQ) params.set('q', location.historyQ);
    if (location.paymentStatus) params.set('status', location.paymentStatus);
    if (location.paymentMethod) params.set('paymentMethod', location.paymentMethod);
    if (location.from) params.set('from', location.from);
    if (location.to) params.set('to', location.to);
    try {
      setHistory(await apiRequest<PaymentListDto>(`/payments?${params}`));
    } catch (error) {
      setHistoryError(
        error instanceof ApiClientError
          ? error.message
          : 'No se pudo cargar el historial de cobros.',
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [
    location.from,
    location.historyPage,
    location.historyQ,
    location.paymentMethod,
    location.paymentStatus,
    location.to,
  ]);

  const loadStudent = useCallback(async (studentId: string) => {
    setStudentLoading(true);
    setMessage('');
    try {
      const selectedStudent = await apiRequest<StudentDto>(`/students/${studentId}`);
      const [chargeResult, paymentResult] = await Promise.all([
        apiRequest<MonthlyChargeListDto>(`/monthly-charges?studentId=${studentId}`),
        apiRequest<PaymentListDto>(`/payments?studentId=${studentId}&pageSize=100`),
      ]);
      setStudent(selectedStudent);
      setCharges(chargeResult.items);
      setPayments(paymentResult.items);
      setTenders(emptyTenders());
    } catch (error) {
      setStudent(null);
      setMessage(
        error instanceof ApiClientError
          ? error.message
          : 'No se pudo cargar el estado de cuenta del alumno.',
      );
    } finally {
      setStudentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!location.studentId && location.tab === 'accounts') void loadReceivables();
  }, [loadReceivables, location.studentId, location.tab]);
  useEffect(() => {
    if (!location.studentId && location.tab === 'history') void loadHistory();
  }, [loadHistory, location.studentId, location.tab]);
  useEffect(() => {
    if (location.studentId) void loadStudent(location.studentId);
    else {
      setStudent(null);
      setCharges([]);
      setPayments([]);
    }
  }, [loadStudent, location.studentId]);
  useEffect(() => {
    if (location.action === 'collect' && student && !studentLoading)
      document.getElementById('registrar-cobro')?.scrollIntoView({ behavior: 'smooth' });
  }, [location.action, student, studentLoading]);

  useEffect(() => {
    if (!voidTarget) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !voiding) setVoidTarget(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [voidTarget, voiding]);

  async function searchStudent(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!query.trim()) return setResults([]);
    try {
      const result = await apiRequest<StudentListDto>(
        `/students?q=${encodeURIComponent(query.trim())}&pageSize=10`,
      );
      setResults(result.items);
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo buscar alumnos.');
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
      setCashShiftRequired(false);
      await Promise.all([loadStudent(student.id), loadReceivables()]);
      setMessage('Pago registrado correctamente.');
    } catch (error) {
      setCashShiftRequired(
        error instanceof ApiClientError && error.error.code === 'CASH_SHIFT_REQUIRED',
      );
      const changed =
        error instanceof ApiClientError &&
        (error.status === 409 || error.error.code === 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE');
      await loadStudent(student.id).catch(() => undefined);
      setMessage(
        changed
          ? 'La deuda cambió mientras registrabas el pago. Actualizamos el estado de cuenta para que puedas revisarlo nuevamente.'
          : error instanceof ApiClientError
            ? error.message
            : 'No se pudo registrar el pago.',
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
      await Promise.all([
        student ? loadStudent(student.id) : Promise.resolve(),
        location.tab === 'history' ? loadHistory() : Promise.resolve(),
        loadReceivables(),
      ]);
      setMessage('Pago anulado y saldos actualizados.');
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo anular el pago.');
    } finally {
      setVoiding(false);
    }
  }

  const changeScope = (scope: ReceivablesScopeDto) =>
    navigate(
      paymentSearch(locationSearch, {
        tab: null,
        studentId: null,
        action: null,
        view: scope,
        page: 1,
      }),
    );
  const studentHref = (studentId: string, collectAction = false) =>
    paymentSearch(locationSearch, {
      studentId,
      action: collectAction ? 'collect' : null,
    });
  const totalAccountPages = Math.max(1, Math.ceil((receivables?.total ?? 0) / 25));
  const totalHistoryPages = Math.max(1, Math.ceil((history?.total ?? 0) / 25));
  const hasAccountFilters =
    location.scope !== 'pending' ||
    Boolean(location.q) ||
    location.sort !== 'oldest' ||
    location.page !== 1;
  const clearAccountFilters = () => {
    setAccountQ('');
    setAccountSort('oldest');
    navigate(
      paymentSearch(locationSearch, {
        view: null,
        q: null,
        sort: null,
        page: null,
      }),
    );
  };
  const clearHistoryFilters = () => {
    setHistoryQ('');
    setHistoryStatus('');
    setHistoryMethod('');
    setHistoryFrom('');
    setHistoryTo('');
    navigate(
      paymentSearch(locationSearch, {
        tab: 'history',
        historyQ: null,
        paymentStatus: null,
        method: null,
        from: null,
        to: null,
        historyPage: null,
      }),
    );
  };

  return (
    <>
      <div className="page-heading payments-heading">
        <div>
          <p className="eyebrow">Facturación</p>
          <h1>{location.studentId ? 'Estado de cuenta' : 'Pagos'}</h1>
          <p className="subtitle">
            {location.studentId
              ? 'Saldos reales, imputación oldest-first e historial del alumno.'
              : 'Centro operativo de cuentas por cobrar y cobros registrados.'}
          </p>
        </div>
        {location.studentId && (
          <a className="button secondary" href={paymentBackHref(locationSearch)}>
            ← {location.tab === 'history' ? 'Historial de cobros' : 'Cuentas por cobrar'}
          </a>
        )}
      </div>
      {cashShiftRequired && (
        <p className="message" role="alert">
          Necesitás abrir tu turno de caja antes de registrar un cobro.{' '}
          <Link href={cashHrefForPayment(locationSearch)}>Abrir caja</Link>
        </p>
      )}

      {!location.studentId && (
        <div aria-label="Vistas de pagos" className="payment-center-tabs" role="tablist">
          <button
            aria-selected={location.tab === 'accounts'}
            className={location.tab === 'accounts' ? 'active' : ''}
            onClick={() =>
              navigate(paymentSearch(locationSearch, { tab: null, historyPage: null }))
            }
            role="tab"
          >
            Cuentas por cobrar
          </button>
          <button
            aria-selected={location.tab === 'history'}
            className={location.tab === 'history' ? 'active' : ''}
            onClick={() =>
              navigate(paymentSearch(locationSearch, { tab: 'history', studentId: null }))
            }
            role="tab"
          >
            Historial de cobros
          </button>
        </div>
      )}

      {!location.studentId && location.tab === 'accounts' && (
        <>
          <section className="card payment-overview" aria-busy={receivablesLoading}>
            <div className="section-heading receivables-heading">
              <div>
                <p className="eyebrow">Cuentas por cobrar</p>
                <h2>
                  {location.scope === 'overdue'
                    ? 'Cuotas vencidas'
                    : location.scope === 'partial'
                      ? 'Cuotas parciales'
                      : location.scope === 'unpaid'
                        ? 'Cuotas sin pagos'
                        : 'Todas las cuentas con saldo'}
                </h2>
                {location.scope === 'overdue' && receivables && (
                  <p className="subtitle">
                    {receivables.summary.totalCharges} cuotas vencidas ·{' '}
                    {receivables.summary.totalStudents} alumnos afectados · Saldo vencido{' '}
                    {money(receivables.summary.totalOutstanding)}
                  </p>
                )}
              </div>
            </div>

            {receivablesError ? (
              <div className="module-state" role="alert">
                <p>{receivablesError}</p>
                <button className="secondary" onClick={() => void loadReceivables()}>
                  Reintentar
                </button>
              </div>
            ) : receivablesLoading && !receivables ? (
              <div className="module-state" role="status">
                {loadingByScope[location.scope]}
              </div>
            ) : receivables ? (
              <div className="account-metrics" aria-label="Resumen de cuentas por cobrar">
                <article className="account-metric primary">
                  <span>Total por cobrar</span>
                  <strong>{money(receivables.summary.totalOutstanding)}</strong>
                  <small>No representa caja ni recaudación.</small>
                </article>
                <article className="account-metric">
                  <span>Cuotas con saldo</span>
                  <strong>{receivables.summary.totalCharges}</strong>
                  <small>{receivables.summary.partialCharges} parciales</small>
                </article>
                <article className="account-metric">
                  <span>Cuotas vencidas</span>
                  <strong>{receivables.summary.overdueCharges}</strong>
                  <small>Según fecha de negocio.</small>
                </article>
                <article className="account-metric">
                  <span>Alumnos con deuda</span>
                  <strong>{receivables.summary.totalStudents}</strong>
                  <small>Personas con saldo abierto.</small>
                </article>
              </div>
            ) : null}
          </section>

          <section className="card receivables-card">
            <div aria-label="Filtrar cuentas por cobrar" className="scope-filters">
              {(Object.entries(scopeLabels) as [ReceivablesScopeDto, string][]).map(
                ([scope, label]) => (
                  <button
                    aria-pressed={location.scope === scope}
                    className={location.scope === scope ? 'active' : 'secondary'}
                    key={scope}
                    onClick={() => changeScope(scope)}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
            <form
              className="payment-account-filters"
              onSubmit={(event) => {
                event.preventDefault();
                navigate(
                  paymentSearch(locationSearch, {
                    view: location.scope,
                    q: accountQ.trim() || null,
                    sort: accountSort,
                    page: 1,
                  }),
                );
              }}
            >
              <label className="search-field">
                Buscar deudor
                <input
                  value={accountQ}
                  onChange={(event) => setAccountQ(event.target.value)}
                  placeholder="Nombre, apellido, DNI o teléfono"
                />
              </label>
              <label>
                Ordenar por
                <select
                  value={accountSort}
                  onChange={(event) => setAccountSort(event.target.value as ReceivablesSortDto)}
                >
                  <option value="oldest">Deuda más antigua</option>
                  <option value="highest-debt">Mayor deuda</option>
                  <option value="name">Nombre</option>
                </select>
              </label>
              <button type="submit">Aplicar</button>
            </form>
            {hasAccountFilters && (
              <div className="context-filter payment-context-chip">
                <span>
                  Filtro activo: <strong>{scopeLabels[location.scope]}</strong>
                </span>
                <button
                  aria-label="Limpiar filtros de cuentas por cobrar"
                  className="link-button"
                  onClick={clearAccountFilters}
                  type="button"
                >
                  Limpiar filtros
                </button>
              </div>
            )}

            {receivablesLoading ? (
              <div className="module-state" role="status">
                {loadingByScope[location.scope]}
              </div>
            ) : receivablesError ? (
              <div className="module-state" role="alert">
                <p>{receivablesError}</p>
                <button className="secondary" onClick={() => void loadReceivables()}>
                  Reintentar
                </button>
              </div>
            ) : receivables && receivables.items.length > 0 ? (
              <>
                <div className="debtor-list">
                  {receivables.items.map((debtor) => (
                    <article className="debtor-row" key={debtor.student.id}>
                      <div className="debtor-identity">
                        <h3>
                          {debtor.student.firstName} {debtor.student.lastName}
                        </h3>
                        <p>DNI {debtor.student.dni}</p>
                        <div className="debtor-badges">
                          <span>{debtor.openChargeCount} con saldo</span>
                          {debtor.overdueChargeCount > 0 && (
                            <span className="status void">
                              {debtor.overdueChargeCount} vencidas
                            </span>
                          )}
                          {debtor.partialChargeCount > 0 && (
                            <span className="status partial">
                              {debtor.partialChargeCount} parciales
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="debtor-situation">
                        <span>Más antigua</span>
                        <strong>{formatDate(debtor.oldestDueDate)}</strong>
                        {Number(debtor.paidAmount) > 0 && (
                          <small>Ya abonado {money(debtor.paidAmount)}</small>
                        )}
                      </div>
                      <div className="debtor-balance">
                        <span>Saldo</span>
                        <strong>{money(debtor.outstandingAmount)}</strong>
                      </div>
                      <div className="debtor-actions">
                        <a className="button secondary" href={studentHref(debtor.student.id)}>
                          Ver cuenta
                        </a>
                        {can('payments:collect') && (
                          <a className="button" href={studentHref(debtor.student.id, true)}>
                            Cobrar
                          </a>
                        )}
                        <a className="text-link" href={`/students/${debtor.student.id}`}>
                          Ver ficha
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="pagination">
                  <button
                    className="secondary"
                    disabled={location.page <= 1 || receivablesLoading}
                    onClick={() =>
                      navigate(paymentSearch(locationSearch, { page: location.page - 1 }))
                    }
                  >
                    Anterior
                  </button>
                  <span>
                    Página {location.page} de {totalAccountPages} · {receivables.total} alumnos
                  </span>
                  <button
                    className="secondary"
                    disabled={location.page >= totalAccountPages || receivablesLoading}
                    onClick={() =>
                      navigate(paymentSearch(locationSearch, { page: location.page + 1 }))
                    }
                  >
                    Siguiente
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h2>{emptyByScope[location.scope]}</h2>
                <p>No encontramos alumnos para los filtros seleccionados.</p>
              </div>
            )}
          </section>

          <StudentSearch
            message={message}
            query={query}
            results={results}
            onQuery={setQuery}
            onSearch={searchStudent}
            onSelect={(id) => navigate(studentHref(id))}
          />
        </>
      )}

      {!location.studentId && location.tab === 'history' && (
        <section className="card payment-history-center">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Operaciones registradas</p>
              <h2>Historial de cobros</h2>
              <p className="subtitle">Consultá cobros sin conocer previamente al alumno.</p>
            </div>
          </div>
          <form
            className="payment-history-filters"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(
                paymentSearch(locationSearch, {
                  tab: 'history',
                  historyQ: historyQ.trim() || null,
                  paymentStatus: historyStatus || null,
                  method: historyMethod || null,
                  from: historyFrom || null,
                  to: historyTo || null,
                  historyPage: 1,
                }),
              );
            }}
          >
            <label className="search-field">
              Buscar alumno
              <input
                value={historyQ}
                onChange={(event) => setHistoryQ(event.target.value)}
                placeholder="Nombre, apellido o DNI"
              />
            </label>
            <label>
              Estado
              <select
                value={historyStatus}
                onChange={(event) => setHistoryStatus(event.target.value as '' | PaymentStatusDto)}
              >
                <option value="">Todos</option>
                <option value="CONFIRMED">Confirmados</option>
                <option value="VOID">Anulados</option>
              </select>
            </label>
            <label>
              Medio
              <select
                value={historyMethod}
                onChange={(event) => setHistoryMethod(event.target.value as '' | PaymentMethodDto)}
              >
                <option value="">Todos</option>
                <option value="CASH">Efectivo</option>
                <option value="MERCADO_PAGO">Mercado Pago</option>
                <option value="CARD">Tarjeta</option>
              </select>
            </label>
            <label>
              Desde
              <input
                type="date"
                value={historyFrom}
                onChange={(event) => setHistoryFrom(event.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={historyTo}
                onChange={(event) => setHistoryTo(event.target.value)}
              />
            </label>
            <div className="history-filter-actions">
              <button type="submit">Aplicar filtros</button>
              <button className="secondary" onClick={clearHistoryFilters} type="button">
                Limpiar
              </button>
            </div>
          </form>

          {historyLoading ? (
            <div className="module-state" role="status">
              Cargando historial de cobros…
            </div>
          ) : historyError ? (
            <div className="module-state" role="alert">
              <p>{historyError}</p>
              <button className="secondary" onClick={() => void loadHistory()}>
                Reintentar
              </button>
            </div>
          ) : history && history.items.length > 0 ? (
            <>
              <PaymentHistory
                canVoid={can('payments:void')}
                payments={history.items}
                showStudent
                studentHref={studentHref}
                onVoid={(payment) => {
                  setVoidTarget(payment);
                  setVoidReason('');
                }}
              />
              <div className="pagination">
                <button
                  className="secondary"
                  disabled={location.historyPage <= 1 || historyLoading}
                  onClick={() =>
                    navigate(
                      paymentSearch(locationSearch, {
                        historyPage: location.historyPage - 1,
                      }),
                    )
                  }
                >
                  Anterior
                </button>
                <span>
                  Página {location.historyPage} de {totalHistoryPages} · {history.total} cobros
                </span>
                <button
                  className="secondary"
                  disabled={location.historyPage >= totalHistoryPages || historyLoading}
                  onClick={() =>
                    navigate(
                      paymentSearch(locationSearch, {
                        historyPage: location.historyPage + 1,
                      }),
                    )
                  }
                >
                  Siguiente
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h2>No hay cobros registrados con estos filtros.</h2>
              <p>Probá limpiar los filtros o ampliar el rango de fechas.</p>
            </div>
          )}
          {message && (
            <p className="message" role="alert">
              {message}
            </p>
          )}
        </section>
      )}

      {location.studentId && (
        <StudentAccount
          allocationPreview={allocationPreview}
          charges={charges}
          debtCents={debtCents}
          exceedsOutstanding={exceedsOutstanding}
          hasInvalidTender={hasInvalidTender}
          loading={studentLoading}
          message={message}
          payments={payments}
          pending={pending}
          student={student}
          submitting={submitting}
          tenders={tenders}
          totalCents={totalCents}
          canVoid={can('payments:void')}
          onCollect={() => void collect()}
          onRetry={() => location.studentId && void loadStudent(location.studentId)}
          onTender={(method, amount) => setTenders((current) => ({ ...current, [method]: amount }))}
          onVoid={(payment) => {
            setVoidTarget(payment);
            setVoidReason('');
          }}
        />
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

function StudentSearch({
  message,
  query,
  results,
  onQuery,
  onSearch,
  onSelect,
}: Readonly<{
  message: string;
  query: string;
  results: readonly StudentDto[];
  onQuery(value: string): void;
  onSearch(event: FormEvent): void;
  onSelect(id: string): void;
}>) {
  return (
    <details className="card any-student-search">
      <summary>Buscar cualquier alumno</summary>
      <p className="subtitle">
        Consultá la cuenta o el historial aunque actualmente no tenga deuda.
      </p>
      <form className="filters" onSubmit={onSearch}>
        <label className="search-field">
          DNI o nombre
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
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
              onClick={() => onSelect(item.id)}
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
    </details>
  );
}

function StudentAccount({
  allocationPreview,
  charges,
  debtCents,
  exceedsOutstanding,
  hasInvalidTender,
  loading,
  message,
  payments,
  pending,
  student,
  submitting,
  tenders,
  totalCents,
  canVoid,
  onCollect,
  onRetry,
  onTender,
  onVoid,
}: Readonly<{
  allocationPreview: ReturnType<typeof previewAllocations>;
  charges: MonthlyChargeListDto['items'];
  debtCents: bigint;
  exceedsOutstanding: boolean;
  hasInvalidTender: boolean;
  loading: boolean;
  message: string;
  payments: PaymentListDto['items'];
  pending: MonthlyChargeListDto['items'];
  student: StudentDto | null;
  submitting: boolean;
  tenders: TenderAmounts;
  totalCents: bigint;
  canVoid: boolean;
  onCollect(): void;
  onRetry(): void;
  onTender(method: keyof TenderAmounts, amount: string): void;
  onVoid(payment: PaymentDto): void;
}>) {
  if (loading)
    return (
      <section className="card module-state" role="status">
        Cargando estado de cuenta…
      </section>
    );
  if (!student)
    return (
      <section className="card module-state" role="alert">
        <p>{message || 'No se pudo cargar el estado de cuenta.'}</p>
        <button className="secondary" onClick={onRetry}>
          Reintentar
        </button>
      </section>
    );
  const overdueCount = pending.filter((charge) => charge.overdue).length;
  const partialCount = pending.filter((charge) => charge.status === 'PARTIAL').length;
  return (
    <>
      <section className="card student-account-header">
        <div>
          <p className="eyebrow">Alumno seleccionado</p>
          <h2>
            {student.firstName} {student.lastName}
          </h2>
          <p>DNI {student.dni}</p>
        </div>
        <a className="text-link" href={`/students/${student.id}`}>
          Ver ficha del alumno
        </a>
      </section>
      <section className="account-metrics student-account-metrics" aria-label="Resumen del alumno">
        <article className="account-metric primary">
          <span>Saldo total</span>
          <strong>{money(outstandingTotal(charges))}</strong>
        </article>
        <article className="account-metric">
          <span>Cuotas con saldo</span>
          <strong>{pending.length}</strong>
        </article>
        <article className="account-metric">
          <span>Vencidas</span>
          <strong>{overdueCount}</strong>
        </article>
        <article className="account-metric">
          <span>Parciales</span>
          <strong>{partialCount}</strong>
        </article>
      </section>
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Estado de cuenta</h2>
            <p className="subtitle">La imputación se realiza primero sobre la cuota más antigua.</p>
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
                  <small>Importe ajustado {money(charge.studentDueAmount)}</small>
                  {charge.adjustments.length > 0 && (
                    <small>
                      {charge.adjustments
                        .map((item) =>
                          item.type === 'LATE_FEE'
                            ? 'Recargo por mora'
                            : item.type === 'DIRECTION_SCHOLARSHIP'
                              ? 'Beca Dirección'
                              : item.type === 'TEACHER_SCHOLARSHIP'
                                ? 'Beca docente'
                                : item.type === 'REVERSAL'
                                  ? 'Corrección'
                                  : 'Descuento docente',
                        )
                        .join(' · ')}
                    </small>
                  )}
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
          <div className="payment-v2-grid" id="registrar-cobro">
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
                      onChange={(event) => onTender(method, event.target.value)}
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
              onClick={onCollect}
            >
              {submitting ? 'Registrando…' : 'Registrar cobro'}
            </button>
          </div>
        )}
        {message && (
          <p className="message" role="alert">
            {message}
          </p>
        )}
      </section>
      <section className="card">
        <h2>Historial del alumno</h2>
        {payments.length === 0 ? (
          <p className="empty-state">No hay pagos registrados.</p>
        ) : (
          <PaymentHistory canVoid={canVoid} payments={payments} onVoid={onVoid} />
        )}
      </section>
    </>
  );
}
