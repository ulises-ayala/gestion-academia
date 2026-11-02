'use client';

import type { CashCollectedDto, CashHandoverDto, CashHandoverListDto } from '@academy/contracts';
import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
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
 * Entregas del efectivo recaudado a Dirección (Administración y Dirección). No es un gasto: queda
 * registrado qué período cubre y cuánto se entregó frente al efectivo cobrado.
 */
export function CashHandovers() {
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
  const [voidTarget, setVoidTarget] = useState<CashHandoverDto | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const problem = handoverProblem(form, today);

  const load = useCallback(async () => {
    const result = await apiRequest<CashHandoverListDto>('/cash-handovers?pageSize=10');
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

  // Efectivo cobrado en el período elegido; precarga el importe mientras no se lo cambie a mano.
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
    try {
      await apiRequest<CashHandoverDto>('/cash-handovers', {
        method: 'POST',
        body: JSON.stringify(handoverPayload(form)),
      });
      const result = await load();
      setForm((current) => ({ ...current, note: '', ...nextHandoverPeriod(result.items, today) }));
      setAmountTouched(false);
      setTried(false);
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
    <section className="panel cash-handovers">
      <h2>Entregas de efectivo a Dirección</h2>
      <p className="subtitle">
        El efectivo recaudado que se le entrega a Dirección. No es un gasto: no cambia la caja ni la
        recaudación.
      </p>
      <form className="cash-range" onSubmit={(event) => void submit(event)} noValidate>
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
        <label className="cash-handover-note">
          Nota (opcional)
          <input
            maxLength={500}
            value={form.note}
            disabled={saving}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? 'Registrando…' : 'Registrar entrega'}
        </button>
      </form>
      {collected !== null && (
        <p className="cash-handover-collected">
          Efectivo que entró a la caja del {shortDate(form.fromDate)} al {shortDate(form.toDate)}:{' '}
          <strong>{money(collected)}</strong>
        </p>
      )}
      {tried && problem && (
        <p className="field-error" role="status">
          {problem}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {list && list.items.length === 0 && (
        <p className="empty-state">Todavía no se registró ninguna entrega.</p>
      )}
      {list && list.items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th>Entregado</th>
                <th>Efectivo en caja</th>
                <th>Diferencia</th>
                <th>Recibió</th>
                <th>Registró</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id} className={item.voidedAt ? 'is-void' : ''}>
                  <td data-label="Período">
                    {shortDate(item.fromDate)} al {shortDate(item.toDate)}
                    {item.note ? <small className="cash-handover-meta">{item.note}</small> : null}
                  </td>
                  <td data-label="Entregado">{money(item.amount)}</td>
                  <td data-label="Efectivo en caja">{money(item.collectedAmount)}</td>
                  <td data-label="Diferencia">{money(item.difference)}</td>
                  <td data-label="Recibió">{item.receivedBy}</td>
                  <td data-label="Registró">{item.createdBy.username}</td>
                  <td data-label="Estado">
                    {item.voidedAt ? (
                      <span className="status inactive" title={item.voidReason ?? undefined}>
                        Anulada
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="secondary"
                        disabled={saving}
                        onClick={() => {
                          setVoidTarget(item);
                          setVoidReason('');
                        }}
                      >
                        Anular
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {voidTarget && (
        <div className="cash-range">
          <label className="cash-handover-note">
            Motivo para anular la entrega del {shortDate(voidTarget.fromDate)} al{' '}
            {shortDate(voidTarget.toDate)}
            <input
              maxLength={500}
              value={voidReason}
              disabled={saving}
              autoFocus
              onChange={(event) => setVoidReason(event.target.value)}
            />
          </label>
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
      )}
    </section>
  );
}
