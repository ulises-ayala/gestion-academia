'use client';

import type {
  CashShiftDto,
  EnrollmentListDto,
  MonthlyChargeDto,
  MonthlyChargePreviewDto,
  PaymentMethodDto,
} from '@academy/contracts';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import {
  adjustmentLabels,
  businessPeriod,
  collectNowAmount,
  defaultDueDate,
  inactiveTariffsFrom,
  periodLabel,
  type InactiveTariff,
  periodRange,
  suggestedPeriod,
} from '../lib/charge-generation';

const money = (value: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));
const methodLabels: Readonly<Record<PaymentMethodDto, string>> = {
  CASH: 'Efectivo',
  MERCADO_PAGO: 'Mercado Pago',
  CARD: 'Tarjeta',
};

export type GenerateChargeResult = Readonly<{ title: string; detail: string; warning?: string }>;

export function GenerateChargeDialog({
  studentId,
  studentName,
  charges,
  canBackfill,
  canCollect,
  canManageTariffs,
  onClose,
  onDone,
}: Readonly<{
  studentId: string;
  studentName: string;
  charges: readonly MonthlyChargeDto[];
  canBackfill: boolean;
  canCollect: boolean;
  canManageTariffs: boolean;
  onClose(): void;
  onDone(result: GenerateChargeResult): void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentListDto['items'] | null>(null);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [period, setPeriod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [preview, setPreview] = useState<MonthlyChargePreviewDto | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [inactiveTariffs, setInactiveTariffs] = useState<InactiveTariff[]>([]);
  const [activating, setActivating] = useState('');
  const [previewVersion, setPreviewVersion] = useState(0);
  const [cashOpen, setCashOpen] = useState<boolean | null>(null);
  const [collectNow, setCollectNow] = useState(false);
  const [method, setMethod] = useState<PaymentMethodDto>('CASH');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const currentPeriod = useMemo(() => businessPeriod(new Date()), []);
  // Con deuda anterior, el cobro se imputaría primero a esa cuota (más antigua).
  const hasOtherDebt = charges.some((charge) => Number(charge.outstandingAmount) > 0);
  const enrollment = enrollments?.find(({ id }) => id === enrollmentId) ?? null;
  const range = enrollment
    ? periodRange({ currentPeriod, canBackfill, enrollmentStart: enrollment.startDate })
    : null;
  const collectAmount = preview ? collectNowAmount(preview) : '0.00';
  const collectBlocked = !canCollect
    ? 'Tu usuario no puede registrar cobros.'
    : hasOtherDebt
      ? 'El alumno tiene otra deuda: generá la cuota y cobrá desde su estado de cuenta, así el pago se aplica en orden.'
      : cashOpen === false
        ? 'caja'
        : preview && Number(collectAmount) === 0
          ? 'Esta cuota no tiene importe a pagar.'
          : '';

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      opener?.focus();
    };
  }, []);

  const choose = (id: string, list: EnrollmentListDto['items']) => {
    const selected = list.find((item) => item.id === id);
    setEnrollmentId(id);
    if (!selected) return;
    const existing = new Set(
      charges.filter((charge) => charge.enrollmentId === id).map((charge) => charge.period),
    );
    const next = suggestedPeriod(
      periodRange({ currentPeriod, canBackfill, enrollmentStart: selected.startDate }),
      currentPeriod,
      existing,
    );
    setPeriod(next);
    setDueDate(defaultDueDate(next));
  };

  useEffect(() => {
    let active = true;
    apiRequest<EnrollmentListDto>(`/enrollments?studentId=${studentId}&status=ACTIVE&pageSize=100`)
      .then((result) => {
        if (!active) return;
        setEnrollments(result.items);
        if (result.items[0]) choose(result.items[0].id, result.items);
      })
      .catch((caught) => {
        if (!active) return;
        setEnrollments([]);
        setError(
          caught instanceof ApiClientError ? caught.message : 'No se pudieron cargar las clases.',
        );
      });
    if (canCollect)
      apiRequest<CashShiftDto | null>('/cash-shifts/current')
        .then((shift) => active && setCashOpen(Boolean(shift)))
        .catch(() => active && setCashOpen(false));
    return () => {
      active = false;
    };
    // Las clases y la caja se consultan una vez al abrir la ventana.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (!enrollmentId || !/^\d{4}-\d{2}$/.test(period)) return;
    let active = true;
    setLoadingPreview(true);
    setPreviewError('');
    setInactiveTariffs([]);
    const params = new URLSearchParams({ enrollmentId, period });
    if (dueDate) params.set('dueDate', dueDate);
    apiRequest<MonthlyChargePreviewDto>(`/monthly-charges/generation-preview?${params}`)
      .then((result) => active && setPreview(result))
      .catch((caught) => {
        if (!active) return;
        setPreview(null);
        setPreviewError(
          caught instanceof ApiClientError ? caught.message : 'No se pudo calcular la cuota.',
        );
        if (caught instanceof ApiClientError) setInactiveTariffs(inactiveTariffsFrom(caught.error));
      })
      .finally(() => active && setLoadingPreview(false));
    return () => {
      active = false;
    };
  }, [enrollmentId, period, dueDate, previewVersion]);

  async function activateTariff(tariff: InactiveTariff) {
    setActivating(tariff.id);
    setError('');
    try {
      await apiRequest(`/tariffs/${tariff.id}/reactivate`, { method: 'POST' });
      setPreviewVersion((version) => version + 1);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo activar la tarifa.');
    } finally {
      setActivating('');
    }
  }

  useEffect(() => {
    if (collectBlocked) setCollectNow(false);
  }, [collectBlocked]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!preview || preview.alreadyExists || saving) return;
    setSaving(true);
    setError('');
    const label = `${preview.className} · ${periodLabel(preview.period)}`;
    try {
      await apiRequest<MonthlyChargeDto>('/monthly-charges/generate', {
        method: 'POST',
        body: JSON.stringify({ enrollmentId, period, dueDate }),
      });
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo generar la cuota.');
      setSaving(false);
      return;
    }
    if (!collectNow) {
      onDone({ title: 'Cuota generada', detail: `${label}. Quedó pendiente de pago.` });
      return;
    }
    try {
      await apiRequest('/payments', {
        method: 'POST',
        body: JSON.stringify({ studentId, tenders: [{ method, amount: collectAmount }] }),
      });
      onDone({
        title: 'Cuota generada y cobrada',
        detail: `${label}. Cobro de ${money(collectAmount)} en ${methodLabels[method]}.`,
      });
    } catch (caught) {
      onDone({
        title: 'Cuota generada',
        detail: `${label}.`,
        warning: `No se pudo registrar el cobro: ${
          caught instanceof ApiClientError ? caught.message : 'error de conexión'
        }. La cuota quedó pendiente; cobrala desde el estado de cuenta.`,
      });
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal card generate-charge-dialog"
      aria-labelledby="generate-charge-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)} className="generate-charge">
        <div>
          <h2 id="generate-charge-title">Generar cuota</h2>
          <p className="modal-copy">
            Alumno: <strong>{studentName}</strong>
          </p>
        </div>
        {enrollments === null ? (
          <p className="modal-copy" role="status">
            Cargando clases…
          </p>
        ) : enrollments.length === 0 ? (
          <p className="modal-copy">
            El alumno no tiene inscripciones activas.{' '}
            <Link className="text-link" href={`/students/${studentId}/enrollments/new`}>
              Inscribirlo a una clase
            </Link>
          </p>
        ) : (
          <>
            <div className="generate-charge-fields">
              <label className="wide">
                Clase
                <select
                  value={enrollmentId}
                  disabled={saving}
                  onChange={(event) => choose(event.target.value, enrollments)}
                >
                  {enrollments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.academicClass.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mes
                <input
                  type="month"
                  required
                  value={period}
                  min={range?.min}
                  max={range?.max}
                  disabled={saving}
                  onChange={(event) => {
                    setPeriod(event.target.value);
                    if (event.target.value) setDueDate(defaultDueDate(event.target.value));
                  }}
                />
              </label>
              <label>
                Vencimiento
                <input
                  type="date"
                  required
                  value={dueDate}
                  min={period ? `${period}-01` : undefined}
                  max={period ? `${period}-10` : undefined}
                  disabled={saving}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
            </div>
            <div className="generate-charge-preview" aria-live="polite">
              {loadingPreview && !preview ? (
                <p className="modal-copy">Calculando…</p>
              ) : previewError ? (
                <>
                  <p className="field-error">{previewError}</p>
                  {inactiveTariffs.map((tariff) => (
                    <p className="generate-charge-tariff" key={tariff.id}>
                      <span>
                        {tariff.name}
                        <small>Desactivada · {money(tariff.amount)}</small>
                      </span>
                      {canManageTariffs && (
                        <button
                          className="secondary"
                          type="button"
                          disabled={Boolean(activating) || saving}
                          onClick={() => void activateTariff(tariff)}
                        >
                          {activating === tariff.id ? 'Activando…' : 'Activar tarifa'}
                        </button>
                      )}
                    </p>
                  ))}
                  {inactiveTariffs.length > 0 && !canManageTariffs && (
                    <p className="modal-copy">
                      Pedile a Administración que la active desde Tarifas.
                    </p>
                  )}
                </>
              ) : preview ? (
                <>
                  <p>
                    <span>
                      {preview.className} · {periodLabel(preview.period)}
                      <small>{preview.tariff.name}</small>
                    </span>
                    <span>{money(preview.tariff.amount)}</span>
                  </p>
                  {preview.adjustments.length > 0 && (
                    <p>
                      <span>
                        {preview.adjustments.map((type) => adjustmentLabels[type]).join(' · ')}
                      </span>
                    </p>
                  )}
                  <p className="generate-charge-total">
                    <span>Importe de la cuota</span>
                    <strong>{money(preview.studentDueAmount)}</strong>
                  </p>
                  {preview.alreadyExists ? (
                    <p className="generate-charge-note is-blocked" role="status">
                      Ya existe la cuota de {periodLabel(preview.period).toLowerCase()} para esta
                      clase.
                    </p>
                  ) : preview.lateFeeOnCollect ? (
                    <p className="generate-charge-note" role="status">
                      Esta cuota ya está vencida: al cobrarla se suma el recargo de $1.000.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
            <fieldset className="generate-charge-payment" disabled={saving}>
              <legend>Pago</legend>
              <label>
                <input
                  type="radio"
                  name="generate-collect"
                  checked={!collectNow}
                  onChange={() => setCollectNow(false)}
                />
                Dejar pendiente
              </label>
              <label>
                <input
                  type="radio"
                  name="generate-collect"
                  checked={collectNow}
                  disabled={Boolean(collectBlocked) || cashOpen === null}
                  onChange={() => setCollectNow(true)}
                />
                Cobrar ahora
              </label>
              {collectNow && (
                <label className="generate-charge-method">
                  Medio de pago
                  <select
                    value={method}
                    onChange={(event) => setMethod(event.target.value as PaymentMethodDto)}
                  >
                    {Object.entries(methodLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {collectBlocked === 'caja' ? (
                <p className="modal-copy">
                  Para cobrar ahora necesitás{' '}
                  <Link className="text-link" href="/cash">
                    abrir tu turno de caja
                  </Link>
                  .
                </p>
              ) : collectBlocked ? (
                <p className="modal-copy">{collectBlocked}</p>
              ) : collectNow && preview ? (
                <p className="generate-charge-collect">
                  Se cobra <strong>{money(collectAmount)}</strong> en {methodLabels[method]}
                  {preview.lateFeeOnCollect ? ' (incluye el recargo)' : ''}.
                </p>
              ) : null}
            </fieldset>
          </>
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
          <button
            type="submit"
            disabled={!preview || preview.alreadyExists || loadingPreview || saving}
          >
            {saving ? 'Guardando…' : collectNow ? 'Generar y cobrar' : 'Generar cuota'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
