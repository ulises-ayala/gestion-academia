'use client';

import type {
  ChargeBatchPreviewDto,
  EnrollmentListDto,
  GenerateChargeBatchDto,
  GeneratedChargeBatchDto,
  MonthlyChargeDto,
  RegisterMessageSendDto,
  StudentDto,
} from '@academy/contracts';
import { Check, MessageCircle, Plus } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import {
  buildChargeGrid,
  cellKey,
  cellNote,
  missingDue,
  monthName,
  openCells,
  reminderText,
  shortMonth,
} from '../lib/charge-grid';
import { businessPeriod } from '../lib/charge-generation';
import { messageUrl } from '../lib/messages';
import { money } from '../lib/money';
import { notifyError, notifySuccess } from '../lib/notify';

const failure = (caught: unknown, fallback: string) =>
  caught instanceof ApiClientError ? caught.message : fallback;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Cuotas del alumno por clase (fila) y mes (columna). Desde acá se generan de una vez las que
 * faltan, se eligen las que viene a pagar y se le manda el detalle por WhatsApp.
 */
export function StudentChargeGrid({
  student,
  charges,
  refreshKey = 0,
  initialEnrollments = null,
  canGenerate,
  onChanged,
  onCollect,
}: Readonly<{
  student: StudentDto;
  charges: readonly MonthlyChargeDto[];
  /** Al cambiar, vuelve a cargar las inscripciones. */
  refreshKey?: number;
  /** Las inscripciones, si quien la usa ya las tiene; después se actualizan solas. */
  initialEnrollments?: EnrollmentListDto['items'] | null;
  canGenerate: boolean;
  /** Se generaron cuotas: la página recarga la deuda. */
  onChanged(): void;
  /** Cobrar estas cuotas: la página las marca en el cobro. */
  onCollect(chargeIds: readonly string[]): void;
}>) {
  const [enrollments, setEnrollments] = useState<EnrollmentListDto['items'] | null>(
    initialEnrollments,
  );
  const [loadError, setLoadError] = useState('');
  const [toGenerate, setToGenerate] = useState<readonly string[]>([]);
  const [toCollect, setToCollect] = useState<readonly string[]>([]);
  const [preview, setPreview] = useState<ChargeBatchPreviewDto | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError('');
    apiRequest<EnrollmentListDto>(`/enrollments?studentId=${student.id}&pageSize=100`)
      .then((result) => active && setEnrollments(result.items))
      .catch(
        (caught) =>
          active && setLoadError(failure(caught, 'No se pudieron cargar las clases del alumno.')),
      );
    return () => {
      active = false;
    };
  }, [refreshKey, student.id]);

  const grid = useMemo(
    () =>
      buildChargeGrid({
        enrollments: enrollments ?? [],
        charges,
        currentPeriod: businessPeriod(new Date()),
      }),
    [charges, enrollments],
  );
  const due = useMemo(() => missingDue(grid), [grid]);
  const open = useMemo(() => openCells(grid), [grid]);
  // Lo marcado que dejó de existir (se generó o se pagó) se descarta solo.
  const generating = toGenerate.filter((key) =>
    grid.rows.some((row) =>
      row.cells.some(
        (cell) => cell.state === 'missing' && cellKey(row.enrollmentId, cell.period) === key,
      ),
    ),
  );
  const collecting = open.filter((charge) => toCollect.includes(charge.id));
  const collectTotal = collecting.reduce(
    (sum, charge) => sum + Number(charge.outstandingAmount),
    0,
  );
  const batchKey = generating.join(',');

  // El importe de lo marcado para generar lo calcula la API (tarifa del mes, becas y descuentos).
  useEffect(() => {
    setPreview(null);
    setPreviewError('');
    if (!batchKey) return;
    let active = true;
    const body: GenerateChargeBatchDto = {
      studentId: student.id,
      items: batchKey.split(',').map((key) => {
        const [enrollmentId, period] = key.split('|') as [string, string];
        return { enrollmentId, period };
      }),
    };
    apiRequest<ChargeBatchPreviewDto>('/monthly-charges/batch-preview', {
      method: 'POST',
      body: JSON.stringify(body),
    })
      .then((result) => active && setPreview(result))
      .catch(
        (caught) =>
          active &&
          setPreviewError(failure(caught, 'No se pudo calcular el importe de las cuotas.')),
      );
    return () => {
      active = false;
    };
  }, [batchKey, student.id]);

  const toggle = (list: readonly string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  async function generate() {
    if (saving || !preview || preview.newCount === 0) return;
    setSaving(true);
    try {
      const result = await apiRequest<GeneratedChargeBatchDto>('/monthly-charges/generate-batch', {
        method: 'POST',
        body: JSON.stringify({
          studentId: student.id,
          items: preview.items
            .filter((item) => !item.alreadyExists)
            .map(({ enrollmentId, period }) => ({ enrollmentId, period })),
        } satisfies GenerateChargeBatchDto),
      });
      notifySuccess(
        `${plural(result.created.length, 'cuota generada', 'cuotas generadas')} para ${student.firstName}.`,
      );
      setToGenerate([]);
      onChanged();
    } catch (caught) {
      notifyError(failure(caught, 'No se pudieron generar las cuotas.'));
    } finally {
      setSaving(false);
    }
  }

  const reminder = reminderText(student.firstName, grid);
  const reminderUrl = reminder ? messageUrl(student.phone, reminder) : null;
  const registerReminder = () => {
    const body: RegisterMessageSendDto = {
      situation: 'CHARGE_OVERDUE',
      templateId: null,
      studentId: student.id,
      body: reminder,
    };
    void apiRequest('/messages/sends', { method: 'POST', body: JSON.stringify(body) }).catch(() =>
      notifyError('Se abrió WhatsApp, pero no se pudo registrar el aviso.'),
    );
  };

  if (loadError)
    return (
      <section className="card charge-grid-card">
        <p className="error" role="alert">
          {loadError}
        </p>
      </section>
    );
  if (!enrollments || (grid.rows.length === 0 && grid.historicalDebt.length === 0)) return null;

  const columns = {
    gridTemplateColumns: `minmax(11rem, 1.6fr) repeat(${grid.periods.length}, minmax(6.75rem, 1fr)) 7rem`,
  };
  return (
    <section aria-labelledby="charge-grid-title" className="card charge-grid-card">
      <div className="section-heading">
        <div>
          <h2 id="charge-grid-title">Cuotas por clase y mes</h2>
          <p className="subtitle">
            {canGenerate
              ? 'Tocá las cuotas sin generar para crearlas de una vez, o las pendientes para cobrarlas.'
              : 'Tocá las cuotas pendientes para cobrarlas.'}
          </p>
        </div>
        {reminderUrl && (
          <a
            className="button secondary"
            href={reminderUrl}
            onClick={registerReminder}
            rel="noreferrer"
            target="_blank"
          >
            <MessageCircle aria-hidden="true" size={16} strokeWidth={1.75} />
            Enviar detalle por WhatsApp
          </a>
        )}
      </div>

      {grid.rows.length > 0 && (
        <div className="charge-grid-scroll">
          <div
            aria-label="Cuotas por clase y mes"
            className="charge-grid"
            role="table"
            style={{ minWidth: `${19 + grid.periods.length * 7.25}rem` }}
          >
            <div className="charge-grid-row is-head" role="row" style={columns}>
              <span role="columnheader">Clase</span>
              {grid.periods.map((period) => (
                <span
                  className={period === grid.currentPeriod ? 'is-current' : ''}
                  key={period}
                  role="columnheader"
                >
                  {shortMonth(period, grid.currentPeriod)}
                </span>
              ))}
              <span className="is-number" role="columnheader">
                Debe
              </span>
            </div>
            {grid.rows.map((row) => (
              <div className="charge-grid-row" key={row.enrollmentId} role="row" style={columns}>
                <span className="charge-grid-class" role="rowheader">
                  <b>{row.className}</b>
                  {(row.modality || row.ended) && (
                    <small>
                      {[row.modality, row.ended ? 'Inscripción finalizada' : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  )}
                </span>
                {row.cells.map((cell) => {
                  const label = `${row.className}, ${monthName(cell.period)}`;
                  const key = cellKey(row.enrollmentId, cell.period);
                  if (cell.state === 'outside')
                    return (
                      <span className="charge-cell is-outside" key={cell.period} role="cell">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">{label}: no corresponde</span>
                      </span>
                    );
                  if (cell.state === 'paid')
                    return (
                      <span className="charge-cell is-paid" key={cell.period} role="cell">
                        <b>
                          <Check aria-hidden="true" size={14} strokeWidth={2} />
                          Pagada
                        </b>
                        <small>{money(cell.charge!.studentDueAmount)}</small>
                        <span className="sr-only">{label}</span>
                      </span>
                    );
                  if (cell.state === 'missing')
                    return canGenerate ? (
                      <span key={cell.period} role="cell">
                        <button
                          aria-label={`${label}: sin generar`}
                          aria-pressed={generating.includes(key)}
                          className="charge-cell is-missing"
                          disabled={saving}
                          onClick={() => setToGenerate((list) => toggle(list, key))}
                          type="button"
                        >
                          <b>
                            <Plus aria-hidden="true" size={14} strokeWidth={2} />
                            Sin generar
                          </b>
                          <small>
                            {generating.includes(key) ? 'Se genera' : 'Tocar para generar'}
                          </small>
                        </button>
                      </span>
                    ) : (
                      <span className="charge-cell is-missing" key={cell.period} role="cell">
                        <b>Sin generar</b>
                        <span className="sr-only">{label}</span>
                      </span>
                    );
                  const charge = cell.charge!;
                  return (
                    <span key={cell.period} role="cell">
                      <button
                        aria-label={`${label}: debe ${money(charge.outstandingAmount)}, ${cellNote(charge)}`}
                        aria-pressed={toCollect.includes(charge.id)}
                        className={`charge-cell is-${cell.state}`}
                        onClick={() => setToCollect((list) => toggle(list, charge.id))}
                        type="button"
                      >
                        <b>{money(charge.outstandingAmount)}</b>
                        <small>{cellNote(charge)}</small>
                      </button>
                    </span>
                  );
                })}
                <span className="charge-grid-total is-number" role="cell">
                  {row.outstanding > 0
                    ? money(row.outstanding)
                    : due.some((item) => item.enrollmentId === row.enrollmentId)
                      ? 'Sin generar'
                      : 'Al día'}
                </span>
              </div>
            ))}
            <div className="charge-grid-row is-foot" role="row" style={columns}>
              <span role="rowheader">Debe por mes</span>
              {grid.totals.map((total, index) => (
                <span className="is-number" key={grid.periods[index]} role="cell">
                  {total > 0 ? money(total) : '—'}
                </span>
              ))}
              <span className="charge-grid-total is-number" role="cell">
                {money(grid.outstanding)}
              </span>
            </div>
          </div>
        </div>
      )}

      {grid.historicalDebt.length > 0 && (
        <p className="charge-grid-note">
          Además debe deuda anterior:{' '}
          {grid.historicalDebt
            .map(
              (charge) =>
                `${charge.description ?? charge.academicClass.name} ${money(charge.outstandingAmount)}`,
            )
            .join(' · ')}
          . Se cobra abajo, en Registrar cobro.
        </p>
      )}

      {canGenerate && due.length > 0 && generating.length === 0 && (
        <div className="charge-grid-bar">
          <p>
            Le {due.length === 1 ? 'falta' : 'faltan'}{' '}
            <strong>{plural(due.length, 'cuota', 'cuotas')}</strong> sin generar hasta{' '}
            {monthName(grid.currentPeriod).toLowerCase()}.
          </p>
          <button
            className="secondary"
            onClick={() =>
              setToGenerate(due.map((item) => cellKey(item.enrollmentId, item.period)))
            }
            type="button"
          >
            Marcar las que faltan
          </button>
        </div>
      )}

      {generating.length > 0 && (
        <div aria-live="polite" className="charge-grid-bar is-generate">
          {previewError ? (
            <p className="error" role="alert">
              {previewError}
            </p>
          ) : preview ? (
            <div>
              <p>
                Se {preview.newCount === 1 ? 'genera' : 'generan'}{' '}
                <strong>{plural(preview.newCount, 'cuota', 'cuotas')}</strong> por{' '}
                <strong>{money(preview.newTotal)}</strong>. Quedan pendientes de pago.
              </p>
              <ul className="charge-grid-preview">
                {preview.items
                  .filter((item) => !item.alreadyExists)
                  .map((item) => (
                    <li key={cellKey(item.enrollmentId, item.period)}>
                      {item.className} · {monthName(item.period)} · {money(item.studentDueAmount)}
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <p role="status">Calculando el importe…</p>
          )}
          <div className="actions">
            <button
              disabled={saving || !preview || preview.newCount === 0}
              onClick={() => void generate()}
              type="button"
            >
              {saving ? 'Generando…' : `Generar ${plural(generating.length, 'cuota', 'cuotas')}`}
            </button>
            <button
              className="secondary"
              disabled={saving}
              onClick={() => setToGenerate([])}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {collecting.length > 0 && (
        <div aria-live="polite" className="charge-grid-bar is-collect">
          <p>
            <strong>{plural(collecting.length, 'cuota marcada', 'cuotas marcadas')}</strong> por{' '}
            <strong>{money(collectTotal)}</strong>. Puede pagar una parte: el importe se cambia en
            el cobro.
          </p>
          <div className="actions">
            <button
              onClick={() => {
                onCollect(collecting.map((charge) => charge.id));
                setToCollect([]);
              }}
              type="button"
            >
              Cobrar lo marcado
            </button>
            <button className="secondary" onClick={() => setToCollect([])} type="button">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
