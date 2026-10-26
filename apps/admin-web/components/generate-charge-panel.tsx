'use client';

import type {
  EnrollmentListDto,
  MonthlyChargeDto,
  MonthlyChargePreviewDto,
} from '@academy/contracts';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import {
  adjustmentLabels,
  businessPeriod,
  defaultDueDate,
  periodLabel,
  periodRange,
  suggestedPeriod,
} from '../lib/charge-generation';
import { notifySuccess } from '../lib/notify';

const money = (value: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));

export function GenerateChargePanel({
  studentId,
  charges,
  canBackfill,
  onGenerated,
  onClose,
}: Readonly<{
  studentId: string;
  charges: readonly MonthlyChargeDto[];
  canBackfill: boolean;
  onGenerated(): void;
  onClose(): void;
}>) {
  const [enrollments, setEnrollments] = useState<EnrollmentListDto['items'] | null>(null);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [period, setPeriod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [preview, setPreview] = useState<MonthlyChargePreviewDto | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const currentPeriod = useMemo(() => businessPeriod(new Date()), []);

  const enrollment = enrollments?.find(({ id }) => id === enrollmentId) ?? null;
  const range = enrollment
    ? periodRange({ currentPeriod, canBackfill, enrollmentStart: enrollment.startDate })
    : null;

  const choose = (id: string, list: EnrollmentListDto['items']) => {
    const selected = list.find((item) => item.id === id);
    setEnrollmentId(id);
    if (!selected) return;
    const nextRange = periodRange({
      currentPeriod,
      canBackfill,
      enrollmentStart: selected.startDate,
    });
    const existing = new Set(
      charges.filter((charge) => charge.enrollmentId === id).map((charge) => charge.period),
    );
    const next = suggestedPeriod(nextRange, currentPeriod, existing);
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
      .catch((error) => {
        if (!active) return;
        setEnrollments([]);
        setMessage(
          error instanceof ApiClientError ? error.message : 'No se pudieron cargar las clases.',
        );
      });
    return () => {
      active = false;
    };
    // Las inscripciones se cargan una vez al abrir el panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (!enrollmentId || !/^\d{4}-\d{2}$/.test(period)) return;
    let active = true;
    setLoadingPreview(true);
    setPreviewError('');
    const params = new URLSearchParams({ enrollmentId, period });
    if (dueDate) params.set('dueDate', dueDate);
    apiRequest<MonthlyChargePreviewDto>(`/monthly-charges/generation-preview?${params}`)
      .then((result) => active && setPreview(result))
      .catch((error) => {
        if (!active) return;
        setPreview(null);
        setPreviewError(
          error instanceof ApiClientError ? error.message : 'No se pudo calcular la cuota.',
        );
      })
      .finally(() => active && setLoadingPreview(false));
    return () => {
      active = false;
    };
  }, [enrollmentId, period, dueDate]);

  async function generate() {
    if (!preview || preview.alreadyExists || submitting) return;
    setSubmitting(true);
    setMessage('');
    try {
      await apiRequest<MonthlyChargeDto>('/monthly-charges/generate', {
        method: 'POST',
        body: JSON.stringify({ enrollmentId, period, dueDate }),
      });
      notifySuccess('Cuota generada', `${preview.className} · ${periodLabel(period)}`);
      onGenerated();
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo generar la cuota.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="generate-charge" aria-labelledby="generate-charge-title">
      <div className="generate-charge-heading">
        <div>
          <h3 id="generate-charge-title">Generar cuota</h3>
          <p className="subtitle">
            Para cobrar un mes que todavía no tiene cuota: el actual o uno adelantado
            {canBackfill ? ', o una deuda de un mes anterior' : ''}.
          </p>
        </div>
      </div>
      {enrollments === null ? (
        <p className="subtitle" role="status">
          Cargando clases…
        </p>
      ) : enrollments.length === 0 ? (
        <p className="empty-state">
          El alumno no tiene inscripciones activas.{' '}
          <Link className="text-link" href={`/students/${studentId}/enrollments/new`}>
            Inscribirlo a una clase
          </Link>
        </p>
      ) : (
        <>
          <div className="generate-charge-fields">
            <label>
              Clase
              <select
                value={enrollmentId}
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
                value={period}
                min={range?.min}
                max={range?.max}
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
                value={dueDate}
                min={period ? `${period}-01` : undefined}
                max={period ? `${period}-10` : undefined}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
          </div>
          <div className="generate-charge-preview" aria-live="polite">
            {loadingPreview && !preview ? (
              <p className="subtitle">Calculando…</p>
            ) : previewError ? (
              <p className="field-error">{previewError}</p>
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
                  <span>A pagar</span>
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
        </>
      )}
      {message && (
        <p className="message" role="alert">
          {message}
        </p>
      )}
      <div className="form-actions">
        <button className="secondary" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={!preview || preview.alreadyExists || loadingPreview || submitting}
          onClick={() => void generate()}
        >
          {submitting ? 'Generando…' : 'Generar cuota'}
        </button>
      </div>
    </section>
  );
}
