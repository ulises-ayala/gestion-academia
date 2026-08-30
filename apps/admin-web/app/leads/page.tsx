'use client';

import type { LeadListDto, LeadSourceDto, LeadStatusDto } from '@academy/contracts';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import {
  isLeadFollowUpOverdue,
  leadPrimaryContact,
  leadSourceLabels,
  leadStatusClass,
  leadStatusLabels,
} from '../../lib/leads';

const pageSize = 25;
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Buenos_Aires',
  }).format(new Date(value));

export default function LeadsPage() {
  const [result, setResult] = useState<LeadListDto>({ items: [], total: 0, page: 1, pageSize });
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'' | LeadStatusDto>('');
  const [source, setSource] = useState<'' | LeadSourceDto>('');
  const [followUp, setFollowUp] = useState<'' | 'PENDING' | 'OVERDUE'>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (query) params.set('q', query);
    if (status) params.set('status', status);
    if (source) params.set('source', source);
    if (followUp) params.set('followUp', followUp);
    try {
      setResult(await apiRequest<LeadListDto>(`/leads?${params}`));
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo consultar la lista');
    } finally {
      setLoading(false);
    }
  }, [followUp, page, query, source, status]);
  useEffect(() => void load(), [load]);
  const filtered = Boolean(query || status || source || followUp);
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  function search(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(draftQuery.trim());
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Seguimiento</p>
          <h1>Potenciales alumnos</h1>
          <p className="subtitle">{result.total} consultas encontradas.</p>
        </div>
        <Link className="button" href="/leads/new">
          Nuevo potencial
        </Link>
      </div>
      <section className="card">
        <form className="lead-filters" onSubmit={search}>
          <label className="search-field">
            Buscar
            <input
              placeholder="Nombre, teléfono, email o Instagram"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
            />
          </label>
          <label>
            Estado
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as '' | LeadStatusDto);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {Object.entries(leadStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Origen
            <select
              value={source}
              onChange={(event) => {
                setSource(event.target.value as '' | LeadSourceDto);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {Object.entries(leadSourceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Seguimiento
            <select
              value={followUp}
              onChange={(event) => {
                setFollowUp(event.target.value as '' | 'PENDING' | 'OVERDUE');
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="PENDING">Con seguimiento pendiente</option>
              <option value="OVERDUE">Vencidos</option>
            </select>
          </label>
          <button type="submit">Buscar</button>
        </form>
        {message && (
          <p className="message" role="alert">
            {message}
          </p>
        )}
        {loading ? (
          <p>Cargando…</p>
        ) : result.items.length === 0 ? (
          <div className="empty-state">
            <h2>
              {filtered
                ? 'No encontramos potenciales con esos filtros.'
                : 'No hay potenciales alumnos registrados.'}
            </h2>
            {!filtered && (
              <Link className="button" href="/leads/new">
                Registrar primera consulta
              </Link>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th>Origen</th>
                  <th>Estado</th>
                  <th>Próximo seguimiento</th>
                  <th>Actualización</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((lead) => {
                  const overdue = isLeadFollowUpOverdue(lead, new Date());
                  return (
                    <tr key={lead.id}>
                      <td data-label="Nombre">
                        <strong>{lead.name}</strong>
                      </td>
                      <td data-label="Contacto">{leadPrimaryContact(lead)}</td>
                      <td data-label="Origen">{leadSourceLabels[lead.source]}</td>
                      <td data-label="Estado">
                        <span className={`status ${leadStatusClass[lead.status]}`}>
                          {leadStatusLabels[lead.status]}
                        </span>
                      </td>
                      <td data-label="Próximo seguimiento">
                        {lead.nextFollowUpAt ? (
                          <span className={overdue ? 'lead-overdue' : ''}>
                            {dateTime(lead.nextFollowUpAt)}
                            {overdue ? ' · Vencido' : ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td data-label="Actualización">{dateTime(lead.updatedAt)}</td>
                      <td data-label="Acciones">
                        <Link className="text-link" href={`/leads/${lead.id}`}>
                          Ver ficha
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <button
            className="secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}
          >
            Anterior
          </button>
          <span>
            Página {result.page} de {pageCount}
          </span>
          <button
            className="secondary"
            disabled={page >= pageCount || loading}
            onClick={() => setPage((value) => value + 1)}
          >
            Siguiente
          </button>
        </div>
      </section>
    </>
  );
}
