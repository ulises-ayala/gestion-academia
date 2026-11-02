'use client';

import type { PaymentDto } from '@academy/contracts';
import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { businessToday } from '../lib/dates';
import {
  correctionFormFrom,
  correctionPayload,
  correctionProblem,
  correctionTotalCents,
} from '../lib/payment-correction';
import { centsToDecimal, paymentMethodLabels, type TenderAmounts } from '../lib/payments';

const money = (value: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));

/**
 * Corregir un pago mal cargado (medio, importe o fecha). El pago se anula y se reemplaza; la caja
 * se corrige en el turno donde se cobró, aunque ya esté cerrado.
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
  const problem = correctionProblem(payment, form, today);

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
        await apiRequest<PaymentDto>(`/payments/${payment.id}/correct`, {
          method: 'POST',
          body: JSON.stringify(correctionPayload(payment, form)),
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
                    setForm({ ...form, tenders: { ...form.tenders, [method]: event.target.value } })
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
        <div className="generate-charge-fields">
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
          <label className="wide">
            Motivo
            <input
              maxLength={500}
              value={form.reason}
              disabled={saving}
              placeholder="Ej.: se cargó como efectivo y era Mercado Pago"
              aria-invalid={tried && form.reason.trim().length < 3}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
            />
          </label>
        </div>
        <p className="modal-copy">
          El pago queda anulado y se registra uno nuevo con estos datos. En la caja se corrige el
          turno donde se cobró, aunque ya esté cerrado. Si cambia el importe, se vuelve a aplicar a
          la cuota más antigua.
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
            {saving ? 'Corrigiendo…' : 'Corregir pago'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
