'use client';

import type { MonthlyChargeListDto, PaymentDto, PaymentMethodDto } from '@academy/contracts';
import React, { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { useAuth } from './auth-provider';
import { chargeLabel } from '../lib/collect-payment';
import { businessToday } from '../lib/dates';
import { hasCredit, refundPayload, refundProblem } from '../lib/payment-credit';
import {
  correctionFormFrom,
  correctionPayload,
  correctionProblem,
  correctionTotalCents,
} from '../lib/payment-correction';
import {
  reallocationCreditCents,
  reallocationFormFrom,
  reallocationPayload,
  reallocationProblem,
  reallocationRows,
  reallocationTotalCents,
} from '../lib/payment-reallocation';
import {
  centsToDecimal,
  decimalToCents,
  payerName,
  paymentMethodLabels,
  type TenderAmounts,
} from '../lib/payments';
import { money } from '../lib/money';

type CorrectionMode = 'tenders' | 'charges' | 'refund';

/**
 * Corregir un pago mal cargado. "Medio, importe o fecha": el pago se anula y se reemplaza; la caja
 * se corrige en el turno donde se cobró, aunque ya esté cerrado. "Cuotas": cambia a qué cuotas se
 * aplicó, sin tocar el pago ni la caja (reimputación); lo que no se aplica queda como saldo a
 * favor. "Devolver saldo": devuelve el saldo a favor, como egreso de la caja de quien devuelve.
 */
export function CorrectPaymentDialog({
  payment,
  initialMode,
  onClose,
  onDone,
}: Readonly<{
  payment: PaymentDto;
  initialMode?: CorrectionMode;
  onClose(): void;
  onDone(corrected: PaymentDto): void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(() => correctionFormFrom(payment));
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  const today = businessToday();
  const byCharges = payment.kind === 'CHARGES';
  const { can } = useAuth();
  // Devolver dinero lo autoriza Dirección (Charo); aplicar el saldo lo hace quien cobra.
  const credit = hasCredit(payment) && can('payments:refund');
  // Con devoluciones el pago ya no se anula ni se reemplaza: solo se reimputa o se devuelve más.
  const refunded = (decimalToCents(payment.refundedAmount) ?? 0n) > 0n;
  const modes: readonly (readonly [CorrectionMode, string])[] = [
    ...(refunded ? [] : [['tenders', 'Medio, importe o fecha'] as const]),
    ...(byCharges ? [['charges', 'Cuotas'] as const] : []),
    ...(credit ? [['refund', 'Devolver saldo'] as const] : []),
  ];
  const [mode, setMode] = useState<CorrectionMode>(
    initialMode && modes.some(([value]) => value === initialMode)
      ? initialMode
      : (modes[0]?.[0] ?? 'tenders'),
  );
  const [refund, setRefund] = useState<{
    amount: string;
    method: PaymentMethodDto;
    fromCashShift: boolean;
  }>({
    amount: payment.creditAmount.replace(/\.00$/, ''),
    method: 'CASH',
    fromCashShift: false,
  });
  const [charges, setCharges] = useState<MonthlyChargeListDto['items'] | null>(null);
  const rows = useMemo(
    () => (charges ? reallocationRows(payment, charges) : []),
    [charges, payment],
  );
  const [chargeForm, setChargeForm] = useState<Readonly<Record<string, string>>>({});
  const problem =
    mode === 'tenders'
      ? correctionProblem(payment, form, today)
      : mode === 'refund'
        ? refundProblem(payment, refund.amount, form.reason)
        : charges === null
          ? 'Cargando cuotas…'
          : reallocationProblem(payment, rows, chargeForm, form.reason);

  useEffect(() => {
    if (mode !== 'charges' || charges !== null || !payment.student) return;
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
          : mode === 'refund'
            ? await apiRequest<PaymentDto>(`/payments/${payment.id}/refunds`, {
                method: 'POST',
                body: JSON.stringify(
                  refundPayload(refund.amount, refund.method, form.reason, refund.fromCashShift),
                ),
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
            {payerName(payment)} · {money(payment.amount)} ·{' '}
            {payment.tenders.map((tender) => paymentMethodLabels[tender.method]).join(' + ')}
          </p>
        </div>
        {credit && (
          <p className="collect-notice" role="status">
            Tiene {money(payment.creditAmount)} de saldo a favor: aplicalo a una cuota en Cuotas o
            devolvelo.
          </p>
        )}
        {modes.length > 1 && (
          <div className="collect-tabs" role="tablist" aria-label="Qué corregís">
            {modes.map(([value, label]) => (
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
                  <span>Aplicado a cuotas</span>
                  <strong>{money(centsToDecimal(reallocationTotalCents(chargeForm)))}</strong>
                </p>
                <p className="generate-charge-total">
                  <span>Queda como saldo a favor</span>
                  <strong>
                    {money(centsToDecimal(reallocationCreditCents(payment, chargeForm)))}
                  </strong>
                </p>
              </>
            )}
          </div>
        ) : mode === 'refund' ? (
          <div className="generate-charge-fields">
            <label>
              Importe a devolver
              <input
                inputMode="decimal"
                value={refund.amount}
                disabled={saving}
                aria-invalid={tried && Boolean(problem)}
                onChange={(event) => setRefund({ ...refund, amount: event.target.value })}
              />
            </label>
            <label>
              Cómo se devuelve
              <select
                value={refund.method}
                disabled={saving}
                onChange={(event) =>
                  setRefund({ ...refund, method: event.target.value as PaymentMethodDto })
                }
              >
                {(Object.keys(paymentMethodLabels) as PaymentMethodDto[]).map((method) => (
                  <option key={method} value={method}>
                    {paymentMethodLabels[method]}
                  </option>
                ))}
              </select>
            </label>
            {refund.method === 'CASH' ? (
              <label className="wide refund-from-cash">
                <input
                  type="checkbox"
                  checked={refund.fromCashShift}
                  disabled={saving}
                  onChange={(event) =>
                    setRefund({ ...refund, fromCashShift: event.target.checked })
                  }
                />
                Sale de la caja de mi turno abierto
                <small className="collect-hint">
                  Sin marcar, queda registrada fuera de la caja (efectivo que guarda Dirección).
                </small>
              </label>
            ) : (
              <p className="wide collect-hint">
                Se registra fuera de la caja: la devolución la hace Dirección desde su cuenta.
              </p>
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
                  : mode === 'refund'
                    ? 'Ej.: pagó dos veces octubre, se le devuelve uno'
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
            : mode === 'refund'
              ? 'La devolución sale de tu turno de caja abierto, con el medio elegido, y queda registrada con el motivo. Un pago con devoluciones ya no se puede anular ni corregir.'
              : 'El pago y la caja no cambian: solo se mueve a qué cuotas se aplicó. Lo que no se aplique queda como saldo a favor, para aplicarlo después o devolverlo. Queda registrado con el motivo.'}
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
            {saving
              ? 'Guardando…'
              : mode === 'tenders'
                ? 'Corregir pago'
                : mode === 'refund'
                  ? 'Registrar devolución'
                  : 'Cambiar cuotas'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
