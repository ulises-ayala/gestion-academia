'use client';

import type {
  CreateLeadDto,
  LeadDto,
  LeadDuplicateListDto,
  LeadSourceDto,
  LeadStatusDto,
  UpdateLeadDto,
} from '@academy/contracts';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { leadSourceLabels, leadStatusLabels, localDateTimeValue } from '../lib/leads';

type LeadFormState = {
  name: string;
  source: LeadSourceDto;
  phone: string;
  email: string;
  instagram: string;
  status: LeadStatusDto;
  notes: string;
  nextFollowUpAt: string;
  lastContactAt: string;
};
const empty: LeadFormState = {
  name: '',
  source: 'WHATSAPP',
  phone: '',
  email: '',
  instagram: '',
  status: 'INQUIRY',
  notes: '',
  nextFollowUpAt: '',
  lastContactAt: '',
};

export function LeadForm({
  lead,
  onSaved,
  onCancel,
}: Readonly<{ lead?: LeadDto; onSaved(lead: LeadDto): void; onCancel?(): void }>) {
  const [form, setForm] = useState<LeadFormState>(
    lead
      ? {
          name: lead.name,
          source: lead.source,
          phone: lead.phone ?? '',
          email: lead.email ?? '',
          instagram: lead.instagram ?? '',
          status: lead.status,
          notes: lead.notes ?? '',
          nextFollowUpAt: localDateTimeValue(lead.nextFollowUpAt),
          lastContactAt: localDateTimeValue(lead.lastContactAt),
        }
      : empty,
  );
  const [duplicates, setDuplicates] = useState<LeadDuplicateListDto['items']>([]);
  const [duplicateAccepted, setDuplicateAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const change = <K extends keyof LeadFormState>(field: K, value: LeadFormState[K]) => {
    setForm({ ...form, [field]: value });
    setDuplicates([]);
    setDuplicateAccepted(false);
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  };
  const payload = (): CreateLeadDto | UpdateLeadDto => ({
    ...form,
    nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : null,
    lastContactAt: form.lastContactAt ? new Date(form.lastContactAt).toISOString() : null,
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      if (!lead && !duplicateAccepted && (form.phone || form.email || form.instagram)) {
        const query = new URLSearchParams();
        if (form.phone) query.set('phone', form.phone);
        if (form.email) query.set('email', form.email);
        if (form.instagram) query.set('instagram', form.instagram);
        const found = await apiRequest<LeadDuplicateListDto>(`/leads/duplicates?${query}`);
        if (found.items.length) {
          setDuplicates(found.items);
          return;
        }
      }
      const saved = await apiRequest<LeadDto>(lead ? `/leads/${lead.id}` : '/leads', {
        method: lead ? 'PATCH' : 'POST',
        body: JSON.stringify(payload()),
      });
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiClientError && error.field)
        setFieldErrors({ [error.field]: error.message });
      else
        setMessage(
          error instanceof ApiClientError ? error.message : 'No se pudo conectar con la API',
        );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="lead-form" onSubmit={submit} noValidate>
      <label className="wide">
        Nombre
        <input
          required
          aria-invalid={Boolean(fieldErrors.name)}
          value={form.name}
          onChange={(event) => change('name', event.target.value)}
        />
        {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
      </label>
      <label>
        Origen
        <select
          value={form.source}
          onChange={(event) => change('source', event.target.value as LeadSourceDto)}
        >
          {Object.entries(leadSourceLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Estado
        <select
          value={form.status}
          onChange={(event) => change('status', event.target.value as LeadStatusDto)}
        >
          {Object.entries(leadStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Teléfono <span className="optional">Opcional</span>
        <input value={form.phone} onChange={(event) => change('phone', event.target.value)} />
      </label>
      <label>
        Email <span className="optional">Opcional</span>
        <input
          type="email"
          aria-invalid={Boolean(fieldErrors.email)}
          value={form.email}
          onChange={(event) => change('email', event.target.value)}
        />
        {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
      </label>
      <label>
        Instagram <span className="optional">Opcional</span>
        <input
          placeholder="@usuario"
          value={form.instagram}
          onChange={(event) => change('instagram', event.target.value)}
        />
      </label>
      <label>
        Próximo seguimiento <span className="optional">Opcional</span>
        <input
          type="datetime-local"
          value={form.nextFollowUpAt}
          onChange={(event) => change('nextFollowUpAt', event.target.value)}
        />
      </label>
      <label>
        Último contacto <span className="optional">Opcional</span>
        <input
          type="datetime-local"
          value={form.lastContactAt}
          onChange={(event) => change('lastContactAt', event.target.value)}
        />
      </label>
      <label className="wide">
        Observaciones <span className="optional">Opcional</span>
        <textarea value={form.notes} onChange={(event) => change('notes', event.target.value)} />
      </label>
      {duplicates.length > 0 && (
        <section className="duplicate-warning wide" role="alert">
          <strong>Encontramos posibles potenciales duplicados.</strong>
          <p>Revisalos antes de crear igualmente el registro.</p>
          <ul>
            {duplicates.map((item) => (
              <li key={item.lead.id}>
                <Link href={`/leads/${item.lead.id}`}>{item.lead.name}</Link> — coincide en{' '}
                {item.matches.join(', ')}
              </li>
            ))}
          </ul>
          <button className="secondary" type="button" onClick={() => setDuplicateAccepted(true)}>
            Crear igualmente
          </button>
        </section>
      )}
      <div className="actions wide">
        <button
          disabled={submitting || (duplicates.length > 0 && !duplicateAccepted)}
          type="submit"
        >
          {submitting ? 'Guardando…' : lead ? 'Guardar cambios' : 'Crear potencial'}
        </button>
        {onCancel && (
          <button className="secondary" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
      {message && (
        <p className="message wide" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
