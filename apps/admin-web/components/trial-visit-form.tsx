'use client';

import type {
  ClassDto,
  LeadSourceDto,
  RegisterTrialVisitDto,
  TrialVisitResultDto,
} from '@academy/contracts';
import Link from 'next/link';
import React, { type FormEvent, useState } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { businessToday, dayMonthYear } from '../lib/dates';
import { leadSourceLabels } from '../lib/leads';

const emptyForm = () => ({
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  source: 'IN_PERSON' as LeadSourceDto,
  classId: '',
  trialDate: businessToday(),
  notes: '',
});

/**
 * Alguien viene a probar una clase gratis: queda como potencial alumno con esa prueba, sin ficha
 * de alumno ni cuota. Si ya estaba cargado (mismo teléfono y nombre), se le suma la prueba.
 */
export function TrialVisitForm({
  classes,
  loadingClasses,
}: Readonly<{ classes: readonly ClassDto[]; loadingClasses: boolean }>) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TrialVisitResultDto | null>(null);

  const setField = (field: keyof ReturnType<typeof emptyForm>, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage('');
    setFieldErrors({});
    const body: RegisterTrialVisitDto = {
      firstName: form.firstName,
      lastName: form.lastName || null,
      phone: form.phone,
      email: form.email || null,
      source: form.source,
      classId: form.classId,
      trialDate: form.trialDate || null,
      notes: form.notes || null,
    };
    try {
      setResult(
        await apiRequest<TrialVisitResultDto>('/leads/trial-visits', {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      );
    } catch (error) {
      if (error instanceof ApiClientError && error.field)
        setFieldErrors({ [error.field]: error.message });
      else
        setMessage(
          error instanceof ApiClientError ? error.message : 'No se pudo registrar la prueba.',
        );
    } finally {
      setSaving(false);
    }
  }

  if (result)
    return (
      <section className="card onboarding-success">
        <p className="eyebrow">Clase de prueba registrada</p>
        <h1>{result.lead.name} quedó como potencial alumno</h1>
        <p>
          Probó {result.trialClass.academicClass.name} el{' '}
          {dayMonthYear(result.trialClass.trialDate)}. No se le genera cuota ni deuda.
        </p>
        {result.existingLead && <p>Ya estaba cargado como potencial: se le sumó esta prueba.</p>}
        <p>
          Si vuelve y se inscribe, buscalo en <strong>Nuevo alumno → Se inscribe</strong> para usar
          sus datos.
        </p>
        <div className="actions">
          <Link className="button secondary" href={`/leads/${result.lead.id}`}>
            Ver potencial
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setForm(emptyForm());
            }}
          >
            Registrar otra prueba
          </button>
        </div>
      </section>
    );

  const error = (field: string) =>
    fieldErrors[field] && <span className="field-error">{fieldErrors[field]}</span>;
  return (
    <form className="onboarding-form" onSubmit={submit} noValidate>
      <section className="card">
        <h2>Quién viene</h2>
        <div className="student-form">
          <label>
            Nombre
            <input
              required
              aria-invalid={Boolean(fieldErrors.firstName)}
              value={form.firstName}
              onChange={(event) => setField('firstName', event.target.value)}
            />
            {error('firstName')}
          </label>
          <label>
            Apellido <span className="optional">Opcional</span>
            <input
              value={form.lastName}
              onChange={(event) => setField('lastName', event.target.value)}
            />
          </label>
          <label>
            Teléfono
            <input
              required
              inputMode="tel"
              aria-invalid={Boolean(fieldErrors.phone)}
              value={form.phone}
              onChange={(event) => setField('phone', event.target.value)}
            />
            {error('phone')}
          </label>
          <label>
            Correo <span className="optional">Opcional</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setField('email', event.target.value)}
            />
          </label>
          <label>
            Cómo llegó
            <select
              value={form.source}
              onChange={(event) => setField('source', event.target.value)}
            >
              {Object.entries(leadSourceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="card">
        <h2>Clase de prueba</h2>
        <p className="subtitle">
          Es gratis y una sola vez por clase. Si quiere volver a la misma clase, tiene que
          inscribirse y pagar.
        </p>
        <div className="student-form">
          <label>
            Clase
            <select
              required
              aria-invalid={Boolean(fieldErrors.classId)}
              disabled={loadingClasses}
              value={form.classId}
              onChange={(event) => setField('classId', event.target.value)}
            >
              <option value="">{loadingClasses ? 'Cargando clases…' : 'Elegí la clase'}</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.danceType.name}
                </option>
              ))}
            </select>
            {error('classId')}
          </label>
          <label>
            Día
            <input
              type="date"
              max={businessToday()}
              aria-invalid={Boolean(fieldErrors.trialDate)}
              value={form.trialDate}
              onChange={(event) => setField('trialDate', event.target.value)}
            />
            {error('trialDate')}
          </label>
          <label className="wide">
            Nota <span className="optional">Opcional</span>
            <input
              maxLength={500}
              value={form.notes}
              onChange={(event) => setField('notes', event.target.value)}
            />
          </label>
        </div>
      </section>
      {message && (
        <p className="message" role="alert">
          {message}
        </p>
      )}
      <div className="actions">
        <button disabled={saving} type="submit">
          {saving ? 'Registrando…' : 'Registrar clase de prueba'}
        </button>
        <Link className="button secondary" href="/leads">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
