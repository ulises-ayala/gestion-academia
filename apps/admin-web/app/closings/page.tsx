'use client';

import type {
  ClosingFiguresDto,
  ClosingKindDto,
  ClosingPreviewDto,
  CollectionClosingDto,
  CollectionClosingListDto,
  PaymentMethodDto,
} from '@academy/contracts';
import { FileDown } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CashHandoverDialog } from '../../components/cash-handovers';
import { ClosingCash } from '../../components/closing-cash';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import {
  closingCutLabel,
  closingKindLabels,
  closingPayload,
  closingPeriodLabel,
  closingPreviewQuery,
  closingSummaryText,
  closingSummaryUrl,
} from '../../lib/closings';
import { businessToday } from '../../lib/dates';
import { paymentMethodLabels } from '../../lib/payments';
import { money } from '../../lib/money';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Buenos_Aires',
  }).format(new Date(value));

/** Recaudación por concepto y medio de un cierre (misma tabla que Reportes). */
function FiguresTable({
  figures,
  caption,
}: Readonly<{ figures: ClosingFiguresDto; caption: string }>) {
  const { collections, refunds } = figures;
  if (collections.byConceptAndMethod.length === 0)
    return <p className="empty-state">No hubo cobros en este período.</p>;
  return (
    <>
      <div className="table-wrap reports-concepts">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th>Concepto</th>
              {collections.byMethod.map((item) => (
                <th key={item.method}>{paymentMethodLabels[item.method]}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {collections.byConceptAndMethod.map((row) => (
              <tr key={row.concept}>
                <td data-label="Concepto">{row.label}</td>
                {row.byMethod.map((item) => (
                  <td key={item.method} data-label={paymentMethodLabels[item.method]}>
                    {money(item.amount)}
                  </td>
                ))}
                <td data-label="Total">
                  <strong>{money(row.total)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {collections.byMethod.map((item) => (
                <td key={item.method} data-label={paymentMethodLabels[item.method]}>
                  {money(item.amount)}
                </td>
              ))}
              <td data-label="Total">
                <strong>{money(collections.total)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {Number(refunds.total) > 0 && (
        <p className="closing-note">
          Devoluciones de saldo a favor: <strong>{money(refunds.total)}</strong> (
          {refunds.byMethod
            .filter((item) => Number(item.amount) > 0)
            .map((item) => `${paymentMethodLabels[item.method]} ${money(item.amount)}`)
            .join(' · ')}
          )
        </p>
      )}
    </>
  );
}

/** Lo que entró a la cuenta de Mercado Pago en el período, con el detalle de esos cobros. */
function MercadoPagoNote({
  figures,
  fromDate,
  toDate,
}: Readonly<{ figures: ClosingFiguresDto; fromDate: string; toDate: string }>) {
  const amount = figures.collections.byMethod.find((item) => item.method === 'MERCADO_PAGO');
  if (!amount || Number(amount.amount) <= 0) return null;
  return (
    <p className="closing-note">
      Ingresó a la cuenta de Mercado Pago: <strong>{money(amount.amount)}</strong> ·{' '}
      <Link
        className="text-link"
        href={`/payments?tab=history&paymentStatus=CONFIRMED&method=MERCADO_PAGO&from=${fromDate}&to=${toDate}`}
      >
        Ver esos cobros
      </Link>
    </p>
  );
}

/** Alumnos y deuda al cierre (solo el mensual). */
function StudentFigures({ figures }: Readonly<{ figures: ClosingFiguresDto }>) {
  const students = figures.students;
  if (!students) return null;
  const items: readonly (readonly [string, string])[] = [
    ['Alumnos activos', String(students.active)],
    ['Nuevos ingresos', String(students.newStudents)],
    ['Bajas', String(students.dropped)],
    ['Cuotas pendientes', String(students.pendingCharges)],
    ['Monto adeudado', money(students.pendingDebt)],
    ['Monto vencido', money(students.overdueDebt)],
  ];
  return (
    <div className="reports-metrics compact closing-students">
      {items.map(([label, value]) => (
        <article key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

/** El resumen sale de la foto guardada, con las entregas de hoy. */
const summaryOf = (closing: CollectionClosingDto) => ({
  kind: closing.kind,
  fromDate: closing.fromDate,
  toDate: closing.toDate,
  sequence: closing.sequence,
  figures: closing.snapshot,
  handovers: closing.handovers,
});

/**
 * Cierres semanales y mensuales de la recaudación: se revisan, se guardan como una foto y después
 * se consultan, se descargan o se imprimen; las correcciones posteriores se ven aparte.
 */
export default function ClosingsPage() {
  const [kind, setKind] = useState<ClosingKindDto>('WEEKLY');
  const [period, setPeriod] = useState<{ fromDate: string; toDate: string } | null>(null);
  const [preview, setPreview] = useState<ClosingPreviewDto | null>(null);
  const [list, setList] = useState<CollectionClosingListDto | null>(null);
  const [selected, setSelected] = useState<CollectionClosingDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Entrega de efectivo que se registra desde un cierre, con su período.
  const [handingOver, setHandingOver] = useState<{ fromDate: string; toDate: string } | null>(null);
  const [reload, setReload] = useState(0);
  const [copied, setCopied] = useState(false);
  // El período que llega con la propuesta ya trae sus importes: no se vuelve a pedir.
  const proposed = useRef<string | null>(null);

  const loadList = useCallback(
    async (value: ClosingKindDto) =>
      setList(await apiRequest<CollectionClosingListDto>(`/closings?kind=${value}&pageSize=24`)),
    [],
  );

  useEffect(() => {
    proposed.current = null;
    setPeriod(null);
    setSelected(null);
    setNotice('');
    loadList(kind).catch(() => setError('No se pudieron cargar los cierres.'));
  }, [kind, loadList]);

  // Vista previa del período propuesto o del elegido.
  useEffect(() => {
    const query = closingPreviewQuery(kind, period);
    if (period && proposed.current === query) return;
    let active = true;
    setError('');
    apiRequest<ClosingPreviewDto>(`/closings/preview?${query}`)
      .then((result) => {
        if (!active) return;
        setPreview(result);
        if (!period) {
          const next = { fromDate: result.fromDate, toDate: result.toDate };
          proposed.current = closingPreviewQuery(kind, next);
          setPeriod(next);
        }
      })
      .catch((caught) => {
        if (!active) return;
        setPreview(null);
        setError(caught instanceof ApiClientError ? caught.message : 'No se pudo calcular.');
      });
    return () => {
      active = false;
    };
  }, [kind, period, reload]);

  async function save() {
    if (!period || !preview?.closable || saving) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest('/closings', {
        method: 'POST',
        body: JSON.stringify(closingPayload(kind, period)),
      });
      setNotice(
        `${closingKindLabels[kind]}: ${closingPeriodLabel(kind, period.fromDate, period.toDate)} guardado.`,
      );
      await loadList(kind);
      setPeriod(null);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo guardar el cierre.');
    } finally {
      setSaving(false);
    }
  }

  // La entrega cubre hasta hoy como máximo (un mes en curso todavía no terminó).
  const registerHandover = (fromDate: string, toDate: string) => {
    const today = businessToday();
    if (fromDate <= today) setHandingOver({ fromDate, toDate: toDate < today ? toDate : today });
  };

  function closeHandover() {
    setHandingOver(null);
    // Las entregas no son parte de la foto: se vuelven a pedir.
    proposed.current = null;
    setReload((value) => value + 1);
    if (selected) void open(selected.id);
  }

  async function copySummary(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('No se pudo copiar el resumen. Mandalo por WhatsApp o descargá el PDF.');
    }
  }

  async function open(id: string) {
    try {
      setCopied(false);
      setSelected(await apiRequest<CollectionClosingDto>(`/closings/${id}`));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo abrir el cierre.');
    }
  }

  return (
    <div className="closings-page">
      <header className="page-heading">
        <div>
          <h1>Cierres</h1>
          <p>
            La recaudación de cada semana y de cada mes, guardada como estaba al cerrar. Lo que se
            corrija después se muestra aparte.
          </p>
        </div>
      </header>

      <div className="collect-tabs closing-tabs" role="tablist" aria-label="Tipo de cierre">
        {(['WEEKLY', 'MONTHLY'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            className={kind === value ? 'is-selected' : ''}
            onClick={() => setKind(value)}
          >
            {closingKindLabels[value]}
          </button>
        ))}
      </div>

      <section className="card closing-next">
        <div className="closing-next-heading">
          <div>
            <h2>Próximo cierre</h2>
            {preview && (
              <p className="subtitle">
                {closingPeriodLabel(kind, preview.fromDate, preview.toDate)}
                {closingCutLabel(preview.fromDate, preview.sequence)
                  ? ` · ${closingCutLabel(preview.fromDate, preview.sequence)}`
                  : ''}
              </p>
            )}
          </div>
          <div className="cash-range">
            {kind === 'WEEKLY' ? (
              <>
                <label>
                  Desde
                  <input
                    type="date"
                    value={period?.fromDate ?? ''}
                    disabled={saving}
                    onChange={(event) =>
                      setPeriod({
                        fromDate: event.target.value,
                        toDate: period?.toDate ?? event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Hasta
                  <input
                    type="date"
                    value={period?.toDate ?? ''}
                    disabled={saving}
                    onChange={(event) =>
                      setPeriod({
                        fromDate: period?.fromDate ?? event.target.value,
                        toDate: event.target.value,
                      })
                    }
                  />
                </label>
              </>
            ) : (
              <label>
                Mes
                <input
                  type="month"
                  value={period?.fromDate.slice(0, 7) ?? ''}
                  disabled={saving}
                  onChange={(event) =>
                    event.target.value &&
                    setPeriod({
                      fromDate: `${event.target.value}-01`,
                      toDate: `${event.target.value}-01`,
                    })
                  }
                />
              </label>
            )}
            <button
              type="button"
              disabled={saving || !preview?.closable}
              onClick={() => void save()}
            >
              {saving ? 'Guardando…' : 'Guardar cierre'}
            </button>
          </div>
        </div>
        {preview?.reason && <p className="form-message">{preview.reason}</p>}
        {notice && (
          <p className="form-message" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {preview && (
          <>
            <FiguresTable
              figures={preview.figures}
              caption="Recaudación por concepto y medio (hoy)"
            />
            <MercadoPagoNote
              figures={preview.figures}
              fromDate={preview.fromDate}
              toDate={preview.toDate}
            />
            <ClosingCash
              handovers={preview.handovers}
              onRegister={() => registerHandover(preview.fromDate, preview.toDate)}
            />
            <StudentFigures figures={preview.figures} />
          </>
        )}
      </section>

      <section className="card">
        <h2>Cierres guardados</h2>
        {list === null ? (
          <p className="modal-copy">Cargando cierres…</p>
        ) : list.items.length === 0 ? (
          <p className="empty-state">
            Todavía no hay cierres {closingKindLabels[kind].toLowerCase()}es.
          </p>
        ) : (
          <ul className="closing-list">
            {list.items.map((item) => (
              <li key={item.id} className={selected?.id === item.id ? 'is-selected' : ''}>
                <span>
                  <strong>{closingPeriodLabel(item.kind, item.fromDate, item.toDate)}</strong>
                  <small>
                    Cerró {item.createdBy.username} el {dateTime(item.createdAt)}
                  </small>
                </span>
                <span className="closing-total">{money(item.total)}</span>
                <button type="button" className="secondary" onClick={() => void open(item.id)}>
                  Ver
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <section className="card closing-detail" aria-labelledby="closing-detail-title">
          <div className="closing-next-heading">
            <div>
              <h2 id="closing-detail-title">
                {closingKindLabels[selected.kind]}:{' '}
                {closingPeriodLabel(selected.kind, selected.fromDate, selected.toDate)}
              </h2>
              <p className="subtitle">
                {closingCutLabel(selected.fromDate, selected.sequence)
                  ? `${closingCutLabel(selected.fromDate, selected.sequence)} · `
                  : ''}
                Foto guardada por {selected.createdBy.username} el {dateTime(selected.createdAt)}.
              </p>
            </div>
            <div className="closing-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => void copySummary(closingSummaryText(summaryOf(selected)))}
              >
                {copied ? 'Resumen copiado' : 'Copiar resumen'}
              </button>
              <a
                className="button secondary"
                href={closingSummaryUrl(closingSummaryText(summaryOf(selected)))}
                target="_blank"
                rel="noopener noreferrer"
              >
                Enviar por WhatsApp
              </a>
              <a
                className="button secondary closing-pdf"
                href={`${apiUrl}/closings/${selected.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileDown aria-hidden="true" size={18} strokeWidth={1.8} />
                Descargar o imprimir PDF
              </a>
            </div>
          </div>
          <FiguresTable figures={selected.snapshot} caption="Recaudación al cerrar" />
          <MercadoPagoNote
            figures={selected.snapshot}
            fromDate={selected.fromDate}
            toDate={selected.toDate}
          />
          <ClosingCash
            handovers={selected.handovers}
            onRegister={() => registerHandover(selected.fromDate, selected.toDate)}
          />
          <StudentFigures figures={selected.snapshot} />
          <h3>Correcciones posteriores al cierre</h3>
          {selected.changes.length === 0 ? (
            <p className="empty-state">No hubo cambios en los importes después del cierre.</p>
          ) : (
            <div className="table-wrap reports-concepts">
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Medio</th>
                    <th>En el cierre</th>
                    <th>Hoy</th>
                    <th>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.changes.map((change) => (
                    <tr key={`${change.concept}-${change.method}`}>
                      <td data-label="Concepto">{change.label}</td>
                      <td data-label="Medio">
                        {paymentMethodLabels[change.method as PaymentMethodDto]}
                      </td>
                      <td data-label="En el cierre">{money(change.original)}</td>
                      <td data-label="Hoy">{money(change.current)}</td>
                      <td data-label="Diferencia">
                        <strong>{money(change.difference)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {handingOver && <CashHandoverDialog initialPeriod={handingOver} onClose={closeHandover} />}
    </div>
  );
}
