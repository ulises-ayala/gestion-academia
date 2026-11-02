'use client';

import type { MonthlyChargeListDto, PaymentDto } from '@academy/contracts';
import React, { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { chargeLabel } from '../lib/collect-payment';
import { businessToday } from '../lib/dates';
import {
  correctionFormFrom,
  correctionPayload,
  correctionProblem,
  correctionTotalCents,
} from '../lib/payment-correction';
import {
  reallocationFormFrom,
  reallocationPayload,
  reallocationProblem,
  reallocationRows,
  reallocationTotalCents,
} from '../lib/payment-reallocation';
import { centsToDecimal, paymentMethodLabels, type TenderAmounts } from '../lib/payments';

const money = (value: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));

/**
 * Corregir un pago mal cargado. "Medio, importe o fecha": el pago se anula y se reemplaza; la caja
 * se corrige en el turno donde se cobró, aunque ya esté cerrado. "Cuotas": cambia a qué cuotas se
 * aplicó, sin tocar el pago ni la caja (reimputación).
 */
export function CorrectPaymentDialog({
  payment,
  onClose,
  onDone,
}: Readonly<{ payment: PaymentDto; onClose(): void; onDone(corrected: PaymentDto): void }>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(() => correctionFormFrom(payment));
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  const today = businessToday();
  const byCharges = payment.kind === 'CHARGES';
  const [mode, setMode] = useState<'tenders' | 'charges'>('tenders');
  const [charges, setCharges] = useState<MonthlyChargeListDto['items'] | null>(null);
  const rows = useMemo(
    () => (charges ? reallocationRows(payment, charges) : []),
    [charges, payment],
  );
  const [chargeForm, setChargeForm] = useState<Readonly<Record<string, string>>>({});
  const problem =
    mode === 'tenders'
      ? correctionProblem(payment, form, today)
      : charges === null
        ? 'Cargando cuotas…'
        : reallocationProblem(payment, rows, chargeForm, form.reason);

  useEffect(() => {
    if (mode !== 'charges' || charges !== null) return;
    apiRequest<MonthlyChargeListDto>(`/monthly-charges?studentId=${payment.student.id}`)
      .then((result) => {
        setCharges(result.items);
        setChargeForm(reallocationFormFrom(reallocationRows(payment, result.items)));
      })
      .catch((caught) => {
        // Vuelve a la otra opción: al elegir Cuotas otra vez se reintenta la carga.
        setMode('tenders');
        setError(
          caught instanceof ApiClientError ? caught.message : 'No se pudieron cargar las cuotas.',
        );
      });
  }, [charges, mode, payment]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      opener?.focus();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (problem || saving) return;
    setSaving(true);
    setError('');
    try {
      onDone(
        mode === 'tenders'
          ? await apiRequest<PaymentDto>(`/payments/${payment.id}/correct`, {
              method: 'POST',
              body: JSON.stringify(correctionPayload(payment, form)),
            })
          : await apiRequest<PaymentDto>(`/payments/${payment.id}/allocations`, {
              method: 'POST',
              body: JSON.stringify(reallocationPayload(chargeForm, form.reason)),
            }),
      );
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo corregir el pago.');
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal card generate-charge-dialog"
      aria-labelledby="correct-payment-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form className="generate-charge" onSubmit={(event) => void submit(event)} noValidate>
        <div>
          <h2 id="correct-payment-title">Corregir pago</h2>
          <p className="modal-copy">
            {payment.student.firstName} {payment.student.lastName} · {money(payment.amount)} ·{' '}
            {payment.tenders.map((tender) => paymentMethodLabels[tender.method]).join(' + ')}
          </p>
        </div>
        {byCharges && (
          <div className="collect-tabs" role="tablist" aria-label="Qué corregís">
            {(
              [
                ['tenders', 'Medio, importe o fecha'],
                ['charges', 'Cuotas'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                className={mode === value ? 'is-selected' : ''}
                disabled={saving}
                onClick={() => {
                  setMode(value);
                  setTried(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {mode === 'charges' ? (
          <div className="collect-panel" role="tabpanel">
            {charges === null ? (
              <p className="modal-copy">Cargando cuotas…</p>
            ) : (
              <>
                <ul className="collect-charges">
                  {rows.map((row) => (
                    <li key={row.charge.id}>
                      <span>
                        <strong>{chargeLabel(row.charge)}</strong>
                        <small>
                          {row.charge.academicClass.name} · puede recibir hasta{' '}
                          {money(centsToDecimal(row.maxCents))}
                        </small>
                      </span>
                      <input
                        className="reallocate-amount"
                        inputMode="decimal"
                        placeholder="0"
                        aria-label={`Importe para ${chargeLabel(row.charge)}`}
                        value={chargeForm[row.charge.id] ?? ''}
                        disabled={saving}
                        onChange={(event) =>
                          setChargeForm({ ...chargeForm, [row.charge.id]: event.target.value })
                        }
                      />
                    </li>
                  ))}
                </ul>
                <p className="generate-charge-total">
                  <span>Total (tiene que dar {money(payment.amount)})</span>
                  <strong>{money(centsToDecimal(reallocationTotalCents(chargeForm)))}</strong>
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="generate-charge-preview other-payment-tenders">
            <p className="modal-copy">Medios e importes correctos</p>
            <div className="generate-charge-fields">
              {(Object.keys(paymentMethodLabels) as (keyof TenderAmounts)[]).map((method) => (
                <label key={method}>
                  {paymentMethodLabels[method]}
                  <input
                    inputMode="decimal"
                    placeholder="0"
                    value={form.tenders[method]}
                    disabled={saving}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        tenders: { ...form.tenders, [method]: event.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="generate-charge-total">
              <span>Total</span>
              <strong>{money(centsToDecimal(correctionTotalCents(form)))}</strong>
            </p>
          </div>
        )}
        <div className="generate-charge-fields">
          {mode === 'tenders' && (
            <label>
              Fecha del pago
              <input
                type="date"
                max={today}
                value={form.paidDate}
                disabled={saving}
                onChange={(event) => setForm({ ...form, paidDate: event.target.value })}
              />
            </label>
          )}
          <label className="wide">
            Motivo
            <input
              maxLength={500}
              value={form.reason}
              disabled={saving}
              placeholder={
                mode === 'tenders'
                  ? 'Ej.: se cargó como efectivo y era Mercado Pago'
                  : 'Ej.: venía a pagar octubre, no septiembre'
              }
              aria-invalid={tried && form.reason.trim().length < 3}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
            />
          </label>
        </div>
        <p className="modal-copy">
          {mode === 'tenders'
            ? 'El pago queda anulado y se registra uno nuevo con estos datos. En la caja se corrige el turno donde se cobró, aunque ya esté cerrado. Si cambia el importe, se vuelve a aplicar a la cuota más antigua.'
            : 'El pago y la caja no cambian: solo se mueve a qué cuotas se aplicó. Queda registrado con el motivo.'}
        </p>
        {tried && problem && (
          <p className="field-error" role="status">
            {problem}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="secondary" type="button" disabled={saving} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Corrigiendo…' : mode === 'tenders' ? 'Corregir pago' : 'Cambiar cuotas'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
