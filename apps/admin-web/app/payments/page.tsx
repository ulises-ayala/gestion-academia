'use client';

import type {
  MonthlyChargeDto,
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
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../components/auth-provider';
import { notifySuccess } from '../../lib/notify';
import { CollectPaymentDialog } from '../../components/collect-payment-dialog';
import { CorrectPaymentDialog } from '../../components/correct-payment-dialog';
import { StudentPaymentList } from '../../components/payment-actions';
import { PaymentHistory } from '../../components/payment-history';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { chargeLabel } from '../../lib/collect-payment';
import { formatDate } from '../../lib/dates';
import {
  paymentBackHref,
  paymentLocationFromSearch,
  paymentSearch,
} from '../../lib/payment-center';
import { hasWaivableLateFee, openCharges, outstandingTotal } from '../../lib/payments';

const money = (value: string | number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));
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
  return (
    <Suspense
      fallback={
        <section className="card module-state" role="status">
          Cargando pagos…
        </section>
      }
    >
      <PaymentsCenter />
    </Suspense>
  );
}

function PaymentsCenter() {
  const { can } = useAuth();
  // La URL sale del router: con la navegación interna (por ejemplo "Ver en Pagos" desde la
  // ficha) window.location todavía tiene la dirección anterior en el primer render.
  const searchParams = useSearchParams();
  const searchText = searchParams.toString();
  const locationSearch = searchText ? `?${searchText}` : '';
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
  // Sube cuando la página cambia algo de la cuenta, para que el panel de cobro recargue.
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState('');
  const [voidTarget, setVoidTarget] = useState<PaymentDto | null>(null);
  const [correctTarget, setCorrectTarget] = useState<PaymentDto | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [waiveTarget, setWaiveTarget] = useState<MonthlyChargeDto | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [waiving, setWaiving] = useState(false);

  // Next sincroniza useSearchParams con history.pushState sin recargar la página.
  const navigate = useCallback((href: string) => {
    window.history.pushState(null, '', href);
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

  // silent: refresca sin desmontar la pantalla (el panel de cobro conserva lo que muestra).
  const loadStudent = useCallback(async (studentId: string, silent = false) => {
    if (!silent) {
      setStudentLoading(true);
      setMessage('');
    }
    try {
      const selectedStudent = await apiRequest<StudentDto>(`/students/${studentId}`);
      const [chargeResult, paymentResult] = await Promise.all([
        apiRequest<MonthlyChargeListDto>(`/monthly-charges?studentId=${studentId}`),
        apiRequest<PaymentListDto>(`/payments?studentId=${studentId}&pageSize=100`),
      ]);
      setStudent(selectedStudent);
      setCharges(chargeResult.items);
      setPayments(paymentResult.items);
    } catch (error) {
      if (silent) return;
      setStudent(null);
      setMessage(
        error instanceof ApiClientError
          ? error.message
          : 'No se pudo cargar el estado de cuenta del alumno.',
      );
    } finally {
      if (!silent) setStudentLoading(false);
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

  const refreshAccount = useCallback(async () => {
    if (!location.studentId) return;
    setRefreshKey((key) => key + 1);
    await loadStudent(location.studentId, true);
  }, [loadStudent, location.studentId]);

  useEffect(() => {
    if (!voidTarget) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !voiding) setVoidTarget(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [voidTarget, voiding]);

  useEffect(() => {
    if (!waiveTarget) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !waiving) setWaiveTarget(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [waiveTarget, waiving]);

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
        location.studentId ? refreshAccount() : Promise.resolve(),
        !location.studentId && location.tab === 'history' ? loadHistory() : Promise.resolve(),
      ]);
      notifySuccess('Pago anulado', 'Los saldos se actualizaron.');
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo anular el pago.');
    } finally {
      setVoiding(false);
    }
  }

  async function paymentCorrected() {
    setCorrectTarget(null);
    await Promise.all([
      location.studentId ? refreshAccount() : Promise.resolve(),
      !location.studentId && location.tab === 'history' ? loadHistory() : Promise.resolve(),
    ]);
    notifySuccess('Pago corregido', 'El original quedó anulado y la caja se ajustó en su turno.');
  }

  async function waiveLateFee() {
    if (!waiveTarget || !waiveReason.trim() || waiving) return;
    setWaiving(true);
    try {
      await apiRequest(`/monthly-charges/${waiveTarget.id}/late-fee/waive`, {
        method: 'POST',
        body: JSON.stringify({ reason: waiveReason.trim() }),
      });
      setWaiveTarget(null);
      setWaiveReason('');
      await refreshAccount();
      notifySuccess('Recargo quitado', 'El saldo se actualizó.');
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo quitar el recargo.');
    } finally {
      setWaiving(false);
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
      {!location.studentId && (
        <div className="page-heading payments-heading">
          <div>
            <p className="eyebrow">Facturación</p>
            <h1>Pagos</h1>
            <p className="subtitle">Centro operativo de cuentas por cobrar y cobros registrados.</p>
          </div>
        </div>
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
                showReceipts
                showStudent
                studentHref={studentHref}
                onVoid={(payment) => {
                  setVoidTarget(payment);
                  setVoidReason('');
                }}
                onCorrect={setCorrectTarget}
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
          backHref={paymentBackHref(locationSearch)}
          backLabel={location.tab === 'history' ? 'Historial de cobros' : 'Cuentas por cobrar'}
          charges={charges}
          loading={studentLoading}
          message={message}
          payments={payments}
          refreshKey={refreshKey}
          student={student}
          focusAmount={location.action === 'collect'}
          canVoid={can('payments:void')}
          canWaiveLateFee={can('charges:manage')}
          onChanged={() => void (location.studentId && loadStudent(location.studentId, true))}
          onRetry={() => location.studentId && void loadStudent(location.studentId)}
          onVoid={(payment) => {
            setVoidTarget(payment);
            setVoidReason('');
          }}
          onCorrect={setCorrectTarget}
          onWaiveLateFee={(charge) => {
            setWaiveTarget(charge);
            setWaiveReason('');
          }}
        />
      )}

      {correctTarget && (
        <CorrectPaymentDialog
          payment={correctTarget}
          onClose={() => setCorrectTarget(null)}
          onDone={() => void paymentCorrected()}
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

      {waiveTarget && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !waiving) setWaiveTarget(null);
          }}
        >
          <section
            aria-labelledby="waive-title"
            aria-modal="true"
            className="modal card"
            role="dialog"
          >
            <h2 id="waive-title">Quitar recargo</h2>
            <p className="modal-copy">
              {waiveTarget.academicClass.name} · {chargeLabel(waiveTarget)}. Indicá por qué no
              corresponde el recargo de $1.000.
            </p>
            <label>
              Motivo
              <textarea
                autoFocus
                maxLength={500}
                value={waiveReason}
                onChange={(event) => setWaiveReason(event.target.value)}
                placeholder="Alumna nueva, la cuota se generó ya vencida"
              />
            </label>
            <p className="modal-note">
              El recargo queda registrado como corregido y no se vuelve a sumar. Si ya se cobró,
              primero anulá ese pago y después volvé a cobrar sin recargo.
            </p>
            <div className="modal-actions">
              <button className="secondary" disabled={waiving} onClick={() => setWaiveTarget(null)}>
                Cancelar
              </button>
              <button disabled={!waiveReason.trim() || waiving} onClick={() => void waiveLateFee()}>
                {waiving ? 'Quitando…' : 'Quitar recargo'}
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

/**
 * Estado de cuenta de un alumno con la misma estructura que el popup "Registrar pago": arriba el
 * alumno en una línea, a la izquierda el cobro (cuotas, clase suelta, deuda anterior) y a la
 * derecha sus pagos con el recibo por WhatsApp, Corregir y Anular a mano.
 */
function StudentAccount({
  backHref,
  backLabel,
  charges,
  loading,
  message,
  payments,
  refreshKey,
  student,
  focusAmount,
  canVoid,
  canWaiveLateFee,
  onChanged,
  onRetry,
  onVoid,
  onCorrect,
  onWaiveLateFee,
}: Readonly<{
  backHref: string;
  backLabel: string;
  charges: MonthlyChargeListDto['items'];
  loading: boolean;
  message: string;
  payments: PaymentListDto['items'];
  refreshKey: number;
  student: StudentDto | null;
  focusAmount: boolean;
  canVoid: boolean;
  canWaiveLateFee: boolean;
  onChanged(): void;
  onRetry(): void;
  onVoid(payment: PaymentDto): void;
  onCorrect(payment: PaymentDto): void;
  onWaiveLateFee(charge: MonthlyChargeDto): void;
}>) {
  const pending = useMemo(() => openCharges(charges), [charges]);
  const back = (
    <a className="button secondary" href={backHref}>
      ← {backLabel}
    </a>
  );
  if (loading)
    return (
      <section className="card module-state" role="status">
        Cargando estado de cuenta…
      </section>
    );
  if (!student)
    return (
      <>
        <div className="page-heading payments-heading">
          <div>
            <p className="eyebrow">Estado de cuenta</p>
            <h1>Alumno no disponible</h1>
          </div>
          {back}
        </div>
        <section className="card module-state" role="alert">
          <p>{message || 'No se pudo cargar el estado de cuenta.'}</p>
          <button className="secondary" onClick={onRetry}>
            Reintentar
          </button>
        </section>
      </>
    );
  const debt = outstandingTotal(charges);
  const overdueCount = pending.filter((charge) => charge.overdue).length;
  const partialCount = pending.filter((charge) => charge.status === 'PARTIAL').length;
  return (
    <>
      <div className="page-heading payments-heading account-heading">
        <div>
          <p className="eyebrow">Estado de cuenta</p>
          <h1>
            {student.firstName} {student.lastName}
          </h1>
          <ul className="account-facts" aria-label="Resumen de la cuenta">
            <li>DNI {student.dni}</li>
            {student.phone && <li>{student.phone}</li>}
            <li className={Number(debt) > 0 ? 'is-debt' : 'is-ok'}>
              {Number(debt) > 0 ? `Debe ${money(debt)}` : 'Al día'}
            </li>
            {overdueCount > 0 && (
              <li className="is-debt">
                {overdueCount} {overdueCount === 1 ? 'vencida' : 'vencidas'}
              </li>
            )}
            {partialCount > 0 && (
              <li>
                {partialCount} {partialCount === 1 ? 'parcial' : 'parciales'}
              </li>
            )}
          </ul>
        </div>
        <div className="account-heading-links">
          <Link className="button secondary" href={`/students/${student.id}`}>
            Ver ficha
          </Link>
          {back}
        </div>
      </div>
      {message && (
        <p className="message" role="alert">
          {message}
        </p>
      )}
      <div className="account-layout">
        <CollectPaymentDialog
          variant="inline"
          initialStudent={student}
          refreshKey={refreshKey}
          focusAmount={focusAmount}
          chargeActions={
            canWaiveLateFee
              ? (charge) =>
                  hasWaivableLateFee(charge) ? (
                    <button
                      className="link-button"
                      type="button"
                      onClick={() => onWaiveLateFee(charge)}
                    >
                      Quitar recargo
                    </button>
                  ) : null
              : undefined
          }
          onChanged={onChanged}
          onClose={() => undefined}
        />
        <section className="card account-payments" id="pagos-del-alumno">
          <div className="section-heading">
            <div>
              <h2>Pagos del alumno</h2>
              <p className="subtitle">
                {payments.length === 0
                  ? 'Todavía no tiene pagos.'
                  : `${payments.length} ${payments.length === 1 ? 'pago' : 'pagos'}, del más nuevo al más viejo.`}
              </p>
            </div>
          </div>
          {payments.length > 0 && (
            <StudentPaymentList
              payments={payments}
              receiptPhone={student.phone}
              canVoid={canVoid}
              onCorrect={onCorrect}
              onVoid={onVoid}
            />
          )}
        </section>
      </div>
    </>
  );
}
