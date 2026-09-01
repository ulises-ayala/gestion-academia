'use client';

import type {
  CashConsolidationDto,
  CashShiftDto,
  CashShiftListDto,
  PaymentMethodDto,
} from '@academy/contracts';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../components/auth-provider';
import { ApiClientError, apiRequest } from '../../lib/api-client';

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

export default function CashPage() {
  const { can } = useAuth();
  const [current, setCurrent] = useState<CashShiftDto | null>(null);
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

  const load = useCallback(async () => {
    try {
      const [active, shifts] = await Promise.all([
        apiRequest<CashShiftDto | null>('/cash-shifts/current'),
        apiRequest<CashShiftListDto>('/cash-shifts?pageSize=20'),
      ]);
      setCurrent(active);
      setHistory(shifts);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cargar Caja.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

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
        <p className="form-message error" role="alert">
          {message}
        </p>
      )}
      {!current ? (
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
            </div>
            <button onClick={() => setClosing(true)}>Cerrar turno</button>
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
      <section className="panel">
        <h2>Cierres</h2>
        {history?.items.length ? (
          <div className="cash-history">
            {history.items.map((shift) => (
              <button
                className="cash-history-row"
                key={shift.id}
                onClick={() => void detail(shift.id)}
              >
                <span>
                  <strong>{shift.user.username}</strong>
                  <small>{new Date(shift.openedAt).toLocaleString('es-AR')}</small>
                </span>
                <span>Sistema {money(shift.expectedAmount)}</span>
                <span>
                  Diferencia {shift.differenceAmount === null ? '—' : money(shift.differenceAmount)}
                </span>
              </button>
            ))}
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
