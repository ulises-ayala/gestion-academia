'use client';

import type {
  CashConsolidationDto,
  CashShiftDto,
  CashShiftListDto,
  PaymentMethodDto,
} from '@academy/contracts';
import { Banknote, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../../components/auth-provider';
import { CashHandoverDialog } from '../../components/cash-handovers';
import { CollectPaymentDialog } from '../../components/collect-payment-dialog';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { safePaymentReturnTo } from '../../lib/contextual-filters';

const methods: readonly PaymentMethodDto[] = ['CASH', 'MERCADO_PAGO', 'TRANSFER', 'CARD'];
const labels: Record<PaymentMethodDto, string> = {
  CASH: 'Efectivo',
  MERCADO_PAGO: 'Mercado Pago',
  TRANSFER: 'Transferencia',
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
  /** Turno cuyo detalle está abierto (en un popup), mientras carga o si falló. */
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState('');
  const [declared, setDeclared] = useState<Record<PaymentMethodDto, string>>({
    CASH: '',
    MERCADO_PAGO: '',
    TRANSFER: '',
    CARD: '',
  });
  const [closing, setClosing] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [handingOver, setHandingOver] = useState(false);
  const [closeError, setCloseError] = useState('');
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
    setDetailId(null);
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
    setCloseError('');
    try {
      await apiRequest(`/cash-shifts/${current.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ declaredByMethod: declared }),
      });
      setClosing(false);
      setDeclared({ CASH: '', MERCADO_PAGO: '', TRANSFER: '', CARD: '' });
      await load();
    } catch (error) {
      setCloseError(
        error instanceof ApiClientError ? error.message : 'No se pudo cerrar el turno.',
      );
    } finally {
      setBusy(false);
    }
  }
  // El detalle se abre en un popup al instante: carga ahí y, si falla, muestra el error ahí
  // (antes aparecía debajo de la tabla y el error arriba de todo, fuera de la vista).
  async function detail(id: string) {
    setDetailId(id);
    setSelected(null);
    setDetailError('');
    try {
      setSelected(await apiRequest<CashShiftDto>(`/cash-shifts/${id}`));
    } catch (error) {
      setDetailError(
        error instanceof ApiClientError ? error.message : 'No se pudo cargar el detalle del turno.',
      );
    }
  }
  const closeDetail = () => {
    setDetailId(null);
    setSelected(null);
    setDetailError('');
  };
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
        {can('cash:reconcile') && (
          <button className="secondary cash-handover-button" onClick={() => setHandingOver(true)}>
            <Banknote aria-hidden="true" size={18} strokeWidth={1.8} />
            Entregar efectivo a Dirección
          </button>
        )}
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
            <div className="cash-heading-title">
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
              {can('payments:collect') && (
                <button
                  className="cash-collect-button"
                  type="button"
                  onClick={() => setCollecting(true)}
                >
                  <CreditCard aria-hidden="true" size={18} strokeWidth={1.8} />
                  Registrar pago
                </button>
              )}
              <button className="secondary" type="button" onClick={() => setClosing(true)}>
                Cerrar turno
              </button>
            </div>
          </div>
          <div className="cash-totals">
            {methods.map((method) => (
              <article key={method} data-method={method}>
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
      {collecting && (
        <CollectPaymentDialog
          onClose={(changed) => {
            setCollecting(false);
            if (changed) void load();
          }}
        />
      )}
      {closing && current && (
        <CashDialog
          titleId="close-shift-title"
          busy={busy}
          onClose={() => {
            setClosing(false);
            setCloseError('');
          }}
        >
          <div>
            <h2 id="close-shift-title">Cerrar turno</h2>
            <p className="modal-copy">
              Declará cuánto figura como cobrado en tu control. Las diferencias no impiden cerrar.
            </p>
          </div>
          <div className="cash-totals cash-close-fields">
            {methods.map((method) => {
              const difference =
                Number(declared[method] || 0) - Number(current.expectedByMethod[method]);
              return (
                <label key={method} data-method={method}>
                  <span>{labels[method]}</span>
                  <small>Esperado {money(current.expectedByMethod[method])}</small>
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
          {closeError && (
            <p className="error" role="alert">
              {closeError}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setClosing(false);
                setCloseError('');
              }}
            >
              Cancelar
            </button>
            <button
              disabled={busy || methods.some((method) => declared[method] === '')}
              onClick={() => void close()}
            >
              {busy ? 'Cerrando…' : 'Confirmar cierre'}
            </button>
          </div>
        </CashDialog>
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
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
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
                        <strong style={{ color: 'var(--text)' }}>{shift.user.username}</strong>
                      </td>

                      <td data-label="Apertura" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(shift.openedAt).toLocaleDateString('es-AR')}{' '}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
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
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              {new Date(shift.closedAt).toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
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
                        <span style={{ fontWeight: 500, color: 'var(--text)' }}>
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
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td
                        data-label="Diferencia"
                        style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        {diffNumber === null ? (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        ) : (
                          <span
                            style={{
                              fontWeight: 600,
                              color: isPositive
                                ? 'var(--success)'
                                : isNegative
                                  ? 'var(--destructive)'
                                  : 'var(--text-muted)',
                            }}
                          >
                            {isPositive
                              ? `+${money(String(diffNumber))}`
                              : money(String(diffNumber))}
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
      {detailId && (
        <CashDialog
          titleId="shift-detail-title"
          busy={false}
          className="cash-detail-dialog"
          onClose={closeDetail}
        >
          <div className="cash-heading">
            <h2 id="shift-detail-title">Detalle del turno</h2>
            <button className="secondary" onClick={closeDetail}>
              Cerrar
            </button>
          </div>
          {detailError ? (
            <p className="error" role="alert">
              {detailError}
            </p>
          ) : !selected ? (
            <p className="modal-copy" role="status">
              Cargando el turno…
            </p>
          ) : (
            <>
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
                  <ClosingLines
                    lines={selected.correctedByMethod}
                    original={selected.closingLines}
                  />
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
            </>
          )}
        </CashDialog>
      )}
      {can('cash:reconcile') && (
        <section className="panel cash-consolidated">
          <div className="cash-consolidated-heading">
            <div>
              <h2>Consolidado</h2>
              <p className="subtitle">Turnos cerrados en el período, por medio de pago.</p>
            </div>
            <div className="cash-range">
              <label>
                Desde
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label>
                Hasta
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <button className="secondary" onClick={() => void consolidate()}>
                Consultar
              </button>
            </div>
          </div>
          {consolidated && (
            <>
              <p className="cash-consolidated-count">{consolidated.shiftCount} turnos</p>
              <div className="cash-totals">
                {consolidated.byMethod.map((line) => (
                  <article key={line.method} data-method={line.method}>
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
      {handingOver && <CashHandoverDialog onClose={() => setHandingOver(false)} />}
    </div>
  );
}

/** Popup de la pantalla de Caja (mismo estilo que los demás diálogos). */
function CashDialog({
  titleId,
  busy,
  onClose,
  className = 'cash-close-dialog',
  children,
}: Readonly<{
  titleId: string;
  busy: boolean;
  onClose(): void;
  className?: string;
  children: ReactNode;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal card generate-charge-dialog ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

const movementLabel = (type: CashShiftDto['movements'][number]['type']) =>
  type === 'COLLECTION' ? 'Cobro' : type === 'REFUND' ? 'Devolución' : 'Anulación';
const moneyClass = (value: string) =>
  Number(value) < 0
    ? 'cash-amount is-negative'
    : Number(value) > 0
      ? 'cash-amount is-positive'
      : 'cash-amount';

/** Movimientos del turno en una tabla: hora, tipo, alumno, medio e importe alineados. */
function MovementList({ shift }: Readonly<{ shift: CashShiftDto }>) {
  return (
    <div className="cash-movement-list">
      <h3>Movimientos</h3>
      {shift.movements.length ? (
        <div className="table-wrap">
          <table className="cash-movement-table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Alumno</th>
                <th>Medio</th>
                <th>Importe</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shift.movements.map((item) => {
                const signed = item.type === 'COLLECTION' ? item.amount : `-${item.amount}`;
                return (
                  <tr key={item.id}>
                    <td data-label="Hora">
                      {new Date(item.createdAt).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td data-label="Tipo">
                      <span className={`cash-movement-type is-${item.type.toLowerCase()}`}>
                        {movementLabel(item.type)}
                      </span>
                    </td>
                    <td data-label="Alumno">
                      {item.student
                        ? `${item.student.firstName} ${item.student.lastName}`
                        : `${item.walkInName ?? ''} (eventual)`}
                    </td>
                    <td data-label="Medio">{labels[item.method]}</td>
                    <td data-label="Importe" className={moneyClass(signed)}>
                      {item.type === 'COLLECTION' ? '+' : '−'}
                      {money(item.amount)}
                    </td>
                    <td data-label="Acciones">
                      <Link
                        className="text-link"
                        href={
                          item.student
                            ? `/payments?tab=history&studentId=${item.student.id}`
                            : '/payments?tab=history'
                        }
                      >
                        Ver cobro
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No hay movimientos en este turno.</p>
      )}
    </div>
  );
}

type ClosingLine = CashShiftDto['closingLines'][number];

/** Los cuatro medios en el mismo orden; un turno viejo sin un medio lo muestra en cero. */
const orderedLines = (lines: readonly ClosingLine[]): ClosingLine[] =>
  methods.map(
    (method) =>
      lines.find((line) => line.method === method) ?? {
        method,
        expectedAmount: '0.00',
        declaredAmount: '0.00',
        differenceAmount: '0.00',
      },
  );

/**
 * Cierre por medio en cards alineadas: lo que dio el sistema, lo declarado y la diferencia
 * (faltan, sobran o sin diferencia). Con `original`, marca lo que se corrigió y el valor de antes.
 */
function ClosingLines({
  lines,
  original,
}: Readonly<{ lines: readonly ClosingLine[]; original?: readonly ClosingLine[] }>) {
  const before = original ? orderedLines(original) : null;
  return (
    <div className="cash-closing-grid">
      {orderedLines(lines).map((line) => {
        const previous = before?.find((item) => item.method === line.method);
        const corrected = previous && previous.declaredAmount !== line.declaredAmount;
        const difference = Number(line.differenceAmount);
        return (
          <article key={line.method} className="cash-closing-card" data-method={line.method}>
            <header>
              <span className="cash-method">{labels[line.method]}</span>
              {corrected && <span className="cash-closing-tag">Corregido</span>}
            </header>
            <dl>
              <div>
                <dt>Sistema</dt>
                <dd>{money(line.expectedAmount)}</dd>
              </div>
              <div>
                <dt>Declarado</dt>
                <dd>
                  {money(line.declaredAmount)}
                  {corrected && <small>antes {money(previous.declaredAmount)}</small>}
                </dd>
              </div>
            </dl>
            <p
              className={`cash-closing-diff${difference < 0 ? ' is-short' : difference > 0 ? ' is-over' : ''}`}
            >
              <span>
                {difference < 0 ? 'Faltan' : difference > 0 ? 'Sobran' : 'Sin diferencia'}
              </span>
              {difference !== 0 && <strong>{money(Math.abs(difference).toFixed(2))}</strong>}
            </p>
          </article>
        );
      })}
    </div>
  );
}
