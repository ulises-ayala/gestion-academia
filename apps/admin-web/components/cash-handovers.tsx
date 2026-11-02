'use client';

import type { CashCollectedDto, CashHandoverDto, CashHandoverListDto } from '@academy/contracts';
import React, { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import {
  handoverPayload,
  handoverProblem,
  nextHandoverPeriod,
  type CashHandoverForm,
} from '../lib/cash-handover';
import { amountInputValue } from '../lib/collect-payment';
import { businessToday } from '../lib/dates';
import { decimalToCents } from '../lib/payments';

const money = (value: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));
const shortDate = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;

/**
 * Popup para entregar el efectivo recaudado a Dirección (Administración y Dirección). No es un
 * gasto: queda registrado qué período cubre y cuánto se entregó frente al efectivo que entró a la
 * caja. Abajo, las últimas entregas con la opción de anular.
 */
export function CashHandoverDialog({ onClose }: Readonly<{ onClose(): void }>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const today = businessToday();
  const [list, setList] = useState<CashHandoverListDto | null>(null);
  const [form, setForm] = useState<CashHandoverForm>({
    fromDate: '',
    toDate: today,
    amount: '',
    receivedBy: 'Dirección',
    note: '',
  });
  const [amountTouched, setAmountTouched] = useState(false);
  const [collected, setCollected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [voidTarget, setVoidTarget] = useState<CashHandoverDto | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const problem = handoverProblem(form, today);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      opener?.focus();
    };
  }, []);

  const load = useCallback(async () => {
    const result = await apiRequest<CashHandoverListDto>('/cash-handovers?pageSize=5');
    setList(result);
    return result;
  }, []);

  useEffect(() => {
    load()
      .then((result) =>
        setForm((current) => ({ ...current, ...nextHandoverPeriod(result.items, today) })),
      )
      .catch((caught) =>
        setError(
          caught instanceof ApiClientError ? caught.message : 'No se pudieron cargar las entregas.',
        ),
      );
  }, [load, today]);

  // Efectivo que entró a la caja en el período; precarga el importe mientras no se lo cambie a mano.
  useEffect(() => {
    if (!form.fromDate || !form.toDate || form.toDate < form.fromDate || form.toDate > today) {
      setCollected(null);
      return;
    }
    let active = true;
    apiRequest<CashCollectedDto>(
      `/cash-handovers/cash-collected?from=${form.fromDate}&to=${form.toDate}`,
    )
      .then((result) => {
        if (!active) return;
        setCollected(result.collected);
        if (!amountTouched)
          setForm((current) => ({
            ...current,
            amount: amountInputValue(decimalToCents(result.collected) ?? 0n),
          }));
      })
      .catch(() => active && setCollected(null));
    return () => {
      active = false;
    };
  }, [amountTouched, form.fromDate, form.toDate, today]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (problem || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiRequest<CashHandoverDto>('/cash-handovers', {
        method: 'POST',
        body: JSON.stringify(handoverPayload(form)),
      });
      const result = await load();
      setForm((current) => ({ ...current, note: '', ...nextHandoverPeriod(result.items, today) }));
      setAmountTouched(false);
      setTried(false);
      setNotice('Entrega registrada.');
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'No se pudo registrar la entrega.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function voidHandover() {
    if (!voidTarget || voidReason.trim().length < 3 || saving) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/cash-handovers/${voidTarget.id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      setVoidTarget(null);
      setVoidReason('');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo anular la entrega.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal card generate-charge-dialog cash-handover-dialog"
      aria-labelledby="cash-handover-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form className="generate-charge" onSubmit={(event) => void submit(event)} noValidate>
        <div>
          <h2 id="cash-handover-title">Entregar efectivo a Dirección</h2>
          <p className="modal-copy">
            No es un gasto: no cambia la caja ni la recaudación, solo deja registrada la entrega.
          </p>
        </div>
        <div className="generate-charge-fields">
          <label>
            Desde
            <input
              type="date"
              max={today}
              value={form.fromDate}
              disabled={saving}
              onChange={(event) => setForm({ ...form, fromDate: event.target.value })}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              max={today}
              value={form.toDate}
              disabled={saving}
              onChange={(event) => setForm({ ...form, toDate: event.target.value })}
            />
          </label>
          <label>
            Importe entregado
            <input
              inputMode="decimal"
              placeholder="0"
              value={form.amount}
              disabled={saving}
              aria-invalid={tried && Boolean(problem)}
              onChange={(event) => {
                setAmountTouched(true);
                setForm({ ...form, amount: event.target.value });
              }}
            />
          </label>
          <label>
            Recibe
            <input
              maxLength={120}
              value={form.receivedBy}
              disabled={saving}
              onChange={(event) => setForm({ ...form, receivedBy: event.target.value })}
            />
          </label>
          <label className="wide">
            Nota (opcional)
            <input
              maxLength={500}
              value={form.note}
              disabled={saving}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </label>
        </div>
        {collected !== null && (
          <p className="generate-charge-total cash-handover-collected">
            <span>
              Efectivo que entró a la caja del {shortDate(form.fromDate)} al{' '}
              {shortDate(form.toDate)}
            </span>
            <strong>{money(collected)}</strong>
          </p>
        )}
        {tried && problem && (
          <p className="field-error" role="status">
            {problem}
          </p>
        )}
        {notice && (
          <p className="form-message" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="secondary" type="button" disabled={saving} onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Registrando…' : 'Registrar entrega'}
          </button>
        </div>
      </form>

      {list && list.items.length > 0 && (
        <section className="cash-handover-history" aria-labelledby="cash-handover-history-title">
          <h3 id="cash-handover-history-title">Últimas entregas</h3>
          <ul>
            {list.items.map((item) => (
              <li key={item.id} className={item.voidedAt ? 'is-void' : ''}>
                <span>
                  <strong>
                    {shortDate(item.fromDate)} al {shortDate(item.toDate)} · {money(item.amount)}
                  </strong>
                  <small>
                    {item.voidedAt
                      ? `Anulada${item.voidReason ? `: ${item.voidReason}` : ''}`
                      : `En caja ${money(item.collectedAmount)} · diferencia ${money(item.difference)} · recibió ${item.receivedBy}`}
                  </small>
                </span>
                {!item.voidedAt && (
                  <button
                    type="button"
                    className="link-button"
                    disabled={saving}
                    onClick={() => {
                      setVoidTarget(item);
                      setVoidReason('');
                    }}
                  >
                    Anular
                  </button>
                )}
              </li>
            ))}
          </ul>
          {voidTarget && (
            <div className="cash-handover-void">
              <label>
                Motivo para anular la del {shortDate(voidTarget.fromDate)} al{' '}
                {shortDate(voidTarget.toDate)}
                <input
                  maxLength={500}
                  value={voidReason}
                  disabled={saving}
                  onChange={(event) => setVoidReason(event.target.value)}
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={saving}
                  onClick={() => setVoidTarget(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving || voidReason.trim().length < 3}
                  onClick={() => void voidHandover()}
                >
                  Anular entrega
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </dialog>
  );
}
