'use client';

import type {
  CashShiftDto,
  ClassListDto,
  OtherPaymentConceptDto,
  PaymentDto,
} from '@academy/contracts';
import Link from 'next/link';
import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import {
  buildOtherPaymentPayload,
  describeOtherPayment,
  otherConceptLabels,
  otherPaymentProblem,
} from '../lib/other-payment';
import {
  centsToDecimal,
  decimalToCents,
  paymentMethodLabels,
  tenderTotal,
  type TenderAmounts,
} from '../lib/payments';

const money = (value: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));

export type OtherPaymentResult = Readonly<{ title: string; detail: string }>;

/** Cobro que no es de cuotas: clase suelta u otro concepto. Entra a la caja igual. */
export function OtherPaymentDialog({
  studentId,
  studentName,
  onClose,
  onDone,
}: Readonly<{
  studentId: string;
  studentName: string;
  onClose(): void;
  onDone(result: OtherPaymentResult): void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [classes, setClasses] = useState<ClassListDto['items'] | null>(null);
  const [cashOpen, setCashOpen] = useState<boolean | null>(null);
  const [concept, setConcept] = useState<OtherPaymentConceptDto>('SINGLE_CLASS');
  const [classId, setClassId] = useState('');
  const [detail, setDetail] = useState('');
  const [tenders, setTenders] = useState<TenderAmounts>({ CASH: '', MERCADO_PAGO: '', CARD: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false);
  const form = { concept, classId, detail };
  const total = tenderTotal(tenders);
  const invalidTender = Object.values(tenders).some(
    (amount) => amount.trim() !== '' && decimalToCents(amount) === null,
  );
  const problem = invalidTender
    ? 'Usá importes positivos con hasta dos decimales.'
    : otherPaymentProblem(form, tenders);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest<ClassListDto>('/classes?status=ACTIVE&pageSize=100')
      .then((result) => active && setClasses(result.items))
      .catch(() => active && setClasses([]));
    apiRequest<CashShiftDto | null>('/cash-shifts/current')
      .then((shift) => active && setCashOpen(Boolean(shift)))
      .catch(() => active && setCashOpen(false));
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (problem || saving || !cashOpen) return;
    setSaving(true);
    setError('');
    try {
      const payment = await apiRequest<PaymentDto>('/payments/other', {
        method: 'POST',
        body: JSON.stringify(buildOtherPaymentPayload(studentId, form, tenders)),
      });
      onDone({
        title: 'Cobro registrado',
        detail: `${describeOtherPayment(payment.otherConcept)} · ${money(payment.amount)}.`,
      });
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'No se pudo registrar el cobro.',
      );
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal card generate-charge-dialog"
      aria-labelledby="other-payment-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)} className="generate-charge" noValidate>
        <div>
          <h2 id="other-payment-title">Otro cobro</h2>
          <p className="modal-copy">
            Alumno: <strong>{studentName}</strong> · para lo que no es una cuota mensual.
          </p>
        </div>
        <fieldset className="generate-charge-payment" disabled={saving}>
          <legend>¿A qué corresponde?</legend>
          {(Object.keys(otherConceptLabels) as OtherPaymentConceptDto[]).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="other-concept"
                checked={concept === value}
                onChange={() => setConcept(value)}
              />
              {otherConceptLabels[value]}
            </label>
          ))}
        </fieldset>
        <div className="generate-charge-fields">
          {concept === 'SINGLE_CLASS' && (
            <label className="wide">
              Clase
              <select
                value={classId}
                disabled={saving || classes === null}
                aria-invalid={tried && !classId}
                onChange={(event) => setClassId(event.target.value)}
              >
                <option value="">{classes === null ? 'Cargando clases…' : 'Elegí la clase'}</option>
                {classes?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.teacher.firstName} {item.teacher.lastName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="wide">
            {concept === 'OTHER' ? 'Detalle' : 'Detalle (opcional)'}
            <input
              maxLength={200}
              value={detail}
              disabled={saving}
              placeholder={concept === 'OTHER' ? 'Ej.: remera del show, seña de vestuario' : ''}
              aria-invalid={tried && concept === 'OTHER' && detail.trim().length < 3}
              onChange={(event) => setDetail(event.target.value)}
            />
          </label>
        </div>
        <div className="generate-charge-preview other-payment-tenders">
          <p className="modal-copy">Importe recibido</p>
          <div className="generate-charge-fields">
            {(Object.keys(paymentMethodLabels) as (keyof TenderAmounts)[]).map((method) => (
              <label key={method}>
                {paymentMethodLabels[method]}
                <input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={tenders[method]}
                  disabled={saving}
                  onChange={(event) => setTenders({ ...tenders, [method]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <p className="generate-charge-total">
            <span>Total</span>
            <strong>{money(centsToDecimal(total))}</strong>
          </p>
        </div>
        {cashOpen === false ? (
          <p className="generate-charge-note is-blocked" role="status">
            Para cobrar necesitás{' '}
            <Link className="text-link" href="/cash">
              abrir tu turno de caja
            </Link>
            .
          </p>
        ) : tried && problem ? (
          <p className="field-error" role="status">
            {problem}
          </p>
        ) : null}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="secondary" type="button" disabled={saving} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving || cashOpen !== true}>
            {saving ? 'Registrando…' : 'Registrar cobro'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
