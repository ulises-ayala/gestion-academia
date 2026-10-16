'use client';

import type {
  CashConsolidationDto,
  CashShiftDto,
  CashShiftListDto,
  PaymentMethodDto,
} from '@academy/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../components/auth-provider';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { safePaymentReturnTo } from '../../lib/contextual-filters';

const methods: readonly PaymentMethodDto[] = ['CASH', 'MERCADO_PAGO', 'CARD'];
const labels: Record<PaymentMethodDto, string> = {
  CASH: 'Efectivo',
  MERCADO_PAGO: 'Mercado Pago',
  CARD: 'Tarjeta',
};
const money = (value: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Buenos_Aires' }).format(new Date());
const businessDate = (value: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Buenos_Aires' }).format(new Date(value));

export default function CashPage() {
  const { can, user } = useAuth();
  const [current, setCurrent] = useState<CashShiftDto | null>(null);
  const [currentLoading, setCurrentLoading] = useState(true);
  const [history, setHistory] = useState<CashShiftListDto | null>(null);
  const [selected, setSelected] = useState<CashShiftDto | null>(null);
  const [declared, setDeclared] = useState<Record<PaymentMethodDto, string>>({
    CASH: '',
    MERCADO_PAGO: '',
    CARD: '',
  });
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [consolidated, setConsolidated] = useState<CashConsolidationDto | null>(null);
  const [correctionMethod, setCorrectionMethod] = useState<PaymentMethodDto>('CASH');
  const [correctedDeclared, setCorrectedDeclared] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [returnTo] = useState(() =>
    typeof window === 'undefined' ? '' : safePaymentReturnTo(window.location.search),
  );

  const load = useCallback(async (signal?: AbortSignal) => {
    setCurrentLoading(true);
    const requestInit: RequestInit = signal ? { signal } : {};
    const [activeResult, historyResult] = await Promise.allSettled([
      apiRequest<CashShiftDto | null>('/cash-shifts/current', requestInit),
      apiRequest<CashShiftListDto>('/cash-shifts?pageSize=20', requestInit),
    ]);
    if (signal?.aborted) return;
    if (activeResult.status === 'fulfilled') setCurrent(activeResult.value);
    if (historyResult.status === 'fulfilled') setHistory(historyResult.value);
    const error =
      activeResult.status === 'rejected'
        ? activeResult.reason
        : historyResult.status === 'rejected'
          ? historyResult.reason
          : null;
    setMessage(
      error
        ? error instanceof ApiClientError
          ? error.message
          : 'No se pudo cargar completamente Caja.'
        : '',
    );
    setCurrentLoading(false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setCurrent(null);
    setHistory(null);
    setSelected(null);
    setClosing(false);
    void load(controller.signal);
    return () => controller.abort();
  }, [load, user.id]);

  async function open() {
    setBusy(true);
    try {
      await apiRequest('/cash-shifts/open', { method: 'POST', body: '{}' });
      await load();
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo abrir el turno.');
    } finally {
      setBusy(false);
    }
  }
  async function close() {
    if (!current) return;
    setBusy(true);
    try {
      await apiRequest(`/cash-shifts/${current.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ declaredByMethod: declared }),
      });
      setClosing(false);
      setDeclared({ CASH: '', MERCADO_PAGO: '', CARD: '' });
      await load();
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cerrar el turno.');
    } finally {
      setBusy(false);
    }
  }
  async function detail(id: string) {
    try {
      setSelected(await apiRequest<CashShiftDto>(`/cash-shifts/${id}`));
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cargar el cierre.');
    }
  }
  async function consolidate() {
    try {
      setConsolidated(
        await apiRequest<CashConsolidationDto>(`/cash-shifts/consolidated?from=${from}&to=${to}`),
      );
    } catch (error) {
      setMessage(
        error instanceof ApiClientError ? error.message : 'No se pudo consolidar el período.',
      );
    }
  }
  async function correct() {
    if (!selected) return;
    try {
      const updated = await apiRequest<CashShiftDto>(
        `/cash-shifts/${selected.id}/reconciliation-corrections`,
        {
          method: 'POST',
          body: JSON.stringify({
            method: correctionMethod,
            correctedDeclaredAmount: correctedDeclared,
            reason: correctionReason,
          }),
        },
      );
      setSelected(updated);
      setCorrectedDeclared('');
      setCorrectionReason('');
      await load();
    } catch (error) {
      setMessage(
        error instanceof ApiClientError ? error.message : 'No se pudo guardar la corrección.',
      );
    }
  }
  const closingDifference = current
    ? methods.reduce(
        (sum, method) =>
          sum + Number(declared[method] || 0) - Number(current.expectedByMethod[method]),
        0,
      )
    : 0;

  return (
    <div className="cash-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">FINANZAS</p>
          <h1>Caja</h1>
          <p>Turnos y cobros registrados automáticamente desde Pagos.</p>
        </div>
      </header>
      {message && (
        <div className="module-state" role="alert">
          <p>{message}</p>
          <button className="secondary" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      )}
      {currentLoading ? (
        <section className="cash-empty panel" aria-busy="true" role="status">
          <p>Cargando tu turno de caja…</p>
        </section>
      ) : !current ? (
        <section className="cash-empty panel">
          <h2>No tenés un turno de caja abierto.</h2>
          <p>Abrí tu turno antes de registrar un cobro. No se solicita fondo inicial.</p>
          <button disabled={busy} onClick={() => void open()}>
            {busy ? 'Abriendo…' : 'Abrir turno'}
          </button>
        </section>
      ) : (
        <section className="panel cash-current">
          <div className="cash-heading">
            <div>
              <span className="status active">Turno abierto</span>
              <h2>Mi turno</h2>
              <p>Desde {new Date(current.openedAt).toLocaleString('es-AR')}</p>
              {businessDate(current.openedAt) !== today() && (
                <p className="form-message">Tenés un turno abierto desde un día anterior.</p>
              )}
            </div>
            <div className="cash-heading-actions">
              {returnTo && (
                <Link className="button secondary" href={returnTo}>
                  Volver al cobro
                </Link>
              )}
              <button onClick={() => setClosing(true)}>Cerrar turno</button>
            </div>
          </div>
          <div className="cash-totals">
            {methods.map((method) => (
              <article key={method}>
                <span>{labels[method]}</span>
                <strong>{money(current.expectedByMethod[method])}</strong>
                <small>Esperado según cobros</small>
              </article>
            ))}
          </div>
          <p>
            <strong>{current.operationCount}</strong> operaciones
          </p>
          <MovementList shift={current} />
        </section>
      )}
      {closing && current && (
        <section className="panel cash-close">
          <h2>Cerrar turno</h2>
          <p>
            Declará cuánto figura como cobrado en tu control. Las diferencias no impiden cerrar.
          </p>
          <div className="cash-totals">
            {methods.map((method) => {
              const difference =
                Number(declared[method] || 0) - Number(current.expectedByMethod[method]);
              return (
                <label key={method}>
                  <span>
                    {labels[method]} · esperado {money(current.expectedByMethod[method])}
                  </span>
                  <input
                    inputMode="decimal"
                    value={declared[method]}
                    onChange={(event) => setDeclared({ ...declared, [method]: event.target.value })}
                    placeholder="0.00"
                  />
                  <small>Diferencia: {money(difference.toFixed(2))}</small>
                </label>
              );
            })}
          </div>
          {methods.every((method) => declared[method] !== '') && closingDifference !== 0 && (
            <p className="form-message" role="status">
              Hay una diferencia de {money(closingDifference.toFixed(2))} entre lo registrado y lo
              declarado. Podés cerrar el turno igualmente.
            </p>
          )}
          <div className="form-actions">
            <button className="secondary" onClick={() => setClosing(false)}>
              Cancelar
            </button>
            <button
              disabled={busy || methods.some((method) => declared[method] === '')}
              onClick={() => void close()}
            >
              Confirmar cierre
            </button>
          </div>
        </section>
      )}
      <section className="panel card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2 style={{ margin: 0 }}>{can('cash:reconcile') ? 'Turnos de caja' : 'Mis turnos'}</h2>
          {history?.total ? (
            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
              {history.total} turnos registrados
            </span>
          ) : null}
        </div>

        {history?.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Responsable</th>
                  <th>Apertura</th>
                  <th>Cierre</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Total Sistema</th>
                  <th style={{ textAlign: 'right' }}>Declarado</th>
                  <th style={{ textAlign: 'right' }}>Diferencia</th>
                  <th style={{ textAlign: 'center', width: '1%' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((shift) => {
                  const diffNumber =
                    shift.differenceAmount !== null ? Number(shift.differenceAmount) : null;
                  const isPositive = diffNumber !== null && diffNumber > 0;
                  const isNegative = diffNumber !== null && diffNumber < 0;

                  return (
                    <tr key={shift.id}>
                      <td data-label="Responsable">
                        <strong style={{ color: '#f3f4f6' }}>{shift.user.username}</strong>
                      </td>

                      <td data-label="Apertura" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(shift.openedAt).toLocaleDateString('es-AR')}{' '}
                        <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                          {new Date(shift.openedAt).toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      <td data-label="Cierre" style={{ whiteSpace: 'nowrap' }}>
                        {shift.closedAt ? (
                          <>
                            {new Date(shift.closedAt).toLocaleDateString('es-AR')}{' '}
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                              {new Date(shift.closedAt).toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: '#6b7280' }}>—</span>
                        )}
                      </td>

                      <td data-label="Estado">
                        <span
                          className={`status ${shift.status === 'OPEN' ? 'active' : 'inactive'}`}
                        >
                          {shift.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                        </span>
                      </td>

                      <td
                        data-label="Total Sistema"
                        style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        <span style={{ fontWeight: 500, color: '#f3f4f6' }}>
                          {money(shift.expectedAmount)}
                        </span>
                      </td>

                      <td
                        data-label="Declarado"
                        style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        {shift.declaredAmount !== null ? (
                          <span>{money(shift.declaredAmount)}</span>
                        ) : (
                          <span style={{ color: '#6b7280' }}>—</span>
                        )}
                      </td>

                      <td
                        data-label="Diferencia"
                        style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        {diffNumber === null ? (
                          <span style={{ color: '#6b7280' }}>—</span>
                        ) : (
                          <span
                            style={{
                              fontWeight: 600,
                              color: isPositive ? '#4ade80' : isNegative ? '#f87171' : '#9ca3af',
                            }}
                          >
                            {isPositive ? `+${money(diffNumber)}` : money(diffNumber)}
                          </span>
                        )}
                      </td>

                      <td
                        data-label="Acción"
                        style={{ textAlign: 'center', whiteSpace: 'nowrap', width: '1%' }}
                      >
                        <button
                          type="button"
                          className="text-link"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '0.2rem 0.5rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() => void detail(shift.id)}
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Todavía no hay turnos para mostrar.</p>
        )}
      </section>
      {selected && (
        <section className="panel">
          <div className="cash-heading">
            <h2>Detalle del turno</h2>
            <button className="secondary" onClick={() => setSelected(null)}>
              Cerrar detalle
            </button>
          </div>
          <p>
            {selected.user.username} · {new Date(selected.openedAt).toLocaleString('es-AR')}
          </p>
          {selected.hasPostCloseMovements && (
            <p className="form-message">
              Hubo movimientos posteriores al cierre. El cierre original se conserva.
            </p>
          )}
          <h3>Cierre original</h3>
          <ClosingLines lines={selected.closingLines} />
          {selected.corrections.length > 0 || selected.hasPostCloseMovements ? (
            <>
              <h3>Estado corregido</h3>
              <ClosingLines lines={selected.correctedByMethod} />
            </>
          ) : null}
          {can('cash:reconcile') && (
            <div className="cash-correction">
              <h3>Corregir declaración</h3>
              <p>La corrección es append-only: el cierre original no se modifica.</p>
              <div className="cash-range">
                <label>
                  Medio
                  <select
                    value={correctionMethod}
                    onChange={(event) =>
                      setCorrectionMethod(event.target.value as PaymentMethodDto)
                    }
                  >
                    {methods.map((method) => (
                      <option key={method} value={method}>
                        {labels[method]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Declarado corregido
                  <input
                    inputMode="decimal"
                    value={correctedDeclared}
                    onChange={(event) => setCorrectedDeclared(event.target.value)}
                  />
                </label>
                <label>
                  Motivo
                  <input
                    value={correctionReason}
                    onChange={(event) => setCorrectionReason(event.target.value)}
                  />
                </label>
                <button
                  disabled={!correctedDeclared || !correctionReason.trim()}
                  onClick={() => void correct()}
                >
                  Guardar corrección
                </button>
              </div>
            </div>
          )}
          <MovementList shift={selected} />
        </section>
      )}
      {can('cash:reconcile') && (
        <section className="panel">
          <h2>Consolidado</h2>
          <div className="cash-range">
            <label>
              Desde
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button onClick={() => void consolidate()}>Consultar</button>
          </div>
          {consolidated && (
            <>
              <p>{consolidated.shiftCount} turnos</p>
              <div className="cash-totals">
                {consolidated.byMethod.map((line) => (
                  <article key={line.method}>
                    <strong>{labels[line.method]}</strong>
                    <span>Sistema al cierre: {money(line.systemAtClose)}</span>
                    <span>Declarado: {money(line.declaredAtClose)}</span>
                    <span>Ajustes posteriores: {money(line.postCloseMovements)}</span>
                    <span>Diferencia actual: {money(line.currentDifference)}</span>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function MovementList({ shift }: Readonly<{ shift: CashShiftDto }>) {
  return (
    <div>
      <h3>Movimientos</h3>
      {shift.movements.length ? (
        <div className="cash-movements">
          {shift.movements.map((item) => (
            <article key={item.id}>
              <span>
                {new Date(item.createdAt).toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <strong>{item.type === 'COLLECTION' ? 'Cobro' : 'Anulación'}</strong>
              <span>
                {item.student.firstName} {item.student.lastName}
              </span>
              <span>{labels[item.method]}</span>
              <strong>
                {item.type === 'COLLECTION' ? '+' : '-'}
                {money(item.amount)}
              </strong>
              <Link
                className="text-link"
                href={`/payments?tab=history&studentId=${item.student.id}`}
              >
                Ver cobro
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <p>No hay movimientos en este turno.</p>
      )}
    </div>
  );
}
function ClosingLines({ lines }: Readonly<{ lines: CashShiftDto['closingLines'] }>) {
  return (
    <div className="cash-totals">
      {lines.map((line) => (
        <article key={line.method}>
          <strong>{labels[line.method]}</strong>
          <span>Sistema: {money(line.expectedAmount)}</span>
          <span>Declarado: {money(line.declaredAmount)}</span>
          <span>Diferencia: {money(line.differenceAmount)}</span>
        </article>
      ))}
    </div>
  );
}
