'use client';

import type { LeadDto } from '@academy/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { LeadForm } from '../../../components/lead-form';
import { ApiClientError, apiRequest } from '../../../lib/api-client';
import {
  isLeadFollowUpOverdue,
  leadSourceLabels,
  leadStatusClass,
  leadStatusLabels,
} from '../../../lib/leads';

const dateTime = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Buenos_Aires',
  }).format(new Date(value));

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<LeadDto | null>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    try {
      setLead(await apiRequest<LeadDto>(`/leads/${id}`));
    } catch (error) {
      setMessage(
        error instanceof ApiClientError ? error.message : 'No se pudo cargar el potencial',
      );
    }
  }, [id]);
  useEffect(() => void load(), [load]);
  if (!lead)
    return (
      <section className="card">
        <p>{message || 'Cargando…'}</p>
      </section>
    );
  const overdue = isLeadFollowUpOverdue(lead, new Date());
  return (
    <>
      <div className="page-heading">
        <div>
          <Link className="back-link" href="/leads">
            ← Volver
          </Link>
          <p className="eyebrow">Potencial alumno</p>
          <h1>{lead.name}</h1>
          <span className={`status ${leadStatusClass[lead.status]}`}>
            {leadStatusLabels[lead.status]}
          </span>
        </div>
        <button className="secondary" onClick={() => setEditing((value) => !value)}>
          Editar
        </button>
      </div>
      {editing && (
        <section className="card">
          <LeadForm
            lead={lead}
            onSaved={(saved) => {
              setLead(saved);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </section>
      )}
      <section className="card">
        <h2>Seguimiento</h2>
        <dl className="detail-grid">
          <div>
            <dt>Origen</dt>
            <dd>{leadSourceLabels[lead.source]}</dd>
          </div>
          <div>
            <dt>Próximo seguimiento</dt>
            <dd className={overdue ? 'lead-overdue' : ''}>
              {lead.nextFollowUpAt
                ? `${dateTime(lead.nextFollowUpAt)}${overdue ? ' · Vencido' : ''}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Último contacto</dt>
            <dd>{lead.lastContactAt ? dateTime(lead.lastContactAt) : '—'}</dd>
          </div>
        </dl>
      </section>
      <section className="card">
        <h2>Contacto</h2>
        <dl className="detail-grid">
          <div>
            <dt>Teléfono</dt>
            <dd>{lead.phone ?? '—'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{lead.email ?? '—'}</dd>
          </div>
          <div>
            <dt>Instagram</dt>
            <dd>{lead.instagram ? `@${lead.instagram.replace(/^@/, '')}` : '—'}</dd>
          </div>
        </dl>
      </section>
      <section className="card">
        <h2>Observaciones</h2>
        <p className="lead-notes">{lead.notes || 'Sin observaciones.'}</p>
      </section>
      <section className="card">
        <h2>Registro</h2>
        <dl className="detail-grid">
          <div>
            <dt>Creado</dt>
            <dd>{dateTime(lead.createdAt)}</dd>
          </div>
          <div>
            <dt>Última modificación</dt>
            <dd>{dateTime(lead.updatedAt)}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
