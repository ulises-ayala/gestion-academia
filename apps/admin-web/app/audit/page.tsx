'use client';

import type { AdminUserDto, AuditLogDto, AuditLogListDto } from '@academy/contracts';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api-client';
import {
  auditActionOptions,
  auditActionTone,
  auditEntityOptions,
  formatAuditAction,
  formatAuditEntity,
  formatAuditField,
  formatAuditValue,
  getChangedAuditFields,
  shortAuditId,
} from '../../lib/audit-presentation';

const pageSize = 20;
const emptyFilters = { entityType: '', action: '', actorUserId: '', from: '', to: '' };
type Filters = typeof emptyFilters;
const dateTime = (date: string) =>
  new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Buenos_Aires',
  }).format(new Date(date));

function Changes({ log }: Readonly<{ log: AuditLogDto }>) {
  const changes = getChangedAuditFields(log);
  if (!changes.length) return null;
  return (
    <section className="audit-change-section" aria-label="Cambios realizados">
      <p className="audit-section-label">Cambios</p>
      <dl className="audit-changes">
        {changes.map((change) => (
          <div key={change.field}>
            <dt>{change.label}</dt>
            <dd>
              <span>
                <small>Antes</small>
                {change.before}
              </span>
              <span className="audit-change-arrow" aria-label="cambió a">
                →
              </span>
              <span>
                <small>Después</small>
                {change.after}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function EventMetadata({ log }: Readonly<{ log: AuditLogDto }>) {
  const metadata = log.metadata ?? {};
  const useful = ['amount', 'paymentMethod']
    .filter((field) => metadata[field] !== undefined)
    .map((field) => ({ field, value: formatAuditValue(field, metadata[field]) }));
  if (!useful.length) return null;
  return (
    <dl className="audit-metadata">
      {useful.map(({ field, value }) => (
        <div key={field}>
          <dt>{formatAuditField(field)}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AuditPage() {
  const [items, setItems] = useState<readonly AuditLogDto[]>([]);
  const [users, setUsers] = useState<readonly AdminUserDto[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const load = useCallback(async (query: Filters, requestedPage: number) => {
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams({
        page: String(requestedPage),
        pageSize: String(pageSize),
      });
      Object.entries(query)
        .filter(([, value]) => value)
        .forEach(([key, value]) => params.set(key, value));
      const result = await apiRequest<AuditLogListDto>(`/audit-logs?${params}`);
      setItems(result.items);
      setTotal(result.total);
    } catch {
      setMessage('No pudimos cargar el historial. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load(appliedFilters, page);
  }, [appliedFilters, load, page]);
  useEffect(() => {
    void apiRequest<AdminUserDto[]>('/users')
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };
  const clear = () => {
    setFilters(emptyFilters);
    setPage(1);
    setAppliedFilters(emptyFilters);
  };
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Auditoría</h1>
          <p className="subtitle">Historial inmutable de modificaciones sensibles.</p>
        </div>
      </div>
      <section className="card audit-filter-card" aria-label="Filtros de auditoría">
        <form className="audit-filters" onSubmit={submit}>
          <label>
            Entidad
            <select
              value={filters.entityType}
              onChange={(event) => setFilters({ ...filters, entityType: event.target.value })}
            >
              {auditEntityOptions.map(([value, label]) => (
                <option key={value || 'all'} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Acción
            <select
              value={filters.action}
              onChange={(event) => setFilters({ ...filters, action: event.target.value })}
            >
              {auditActionOptions.map(([value, label]) => (
                <option key={value || 'all'} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="audit-user-filter">
            Usuario
            <select
              value={filters.actorUserId}
              onChange={(event) => setFilters({ ...filters, actorUserId: event.target.value })}
            >
              <option value="">Todos</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input
              type="datetime-local"
              value={filters.from}
              onChange={(event) => setFilters({ ...filters, from: event.target.value })}
            />
          </label>
          <label>
            Hasta
            <input
              type="datetime-local"
              value={filters.to}
              onChange={(event) => setFilters({ ...filters, to: event.target.value })}
            />
          </label>
          <div className="audit-filter-actions">
            <button className="secondary" type="button" onClick={clear}>
              Limpiar
            </button>
            <button disabled={loading}>{loading ? 'Aplicando…' : 'Aplicar filtros'}</button>
          </div>
        </form>
      </section>
      {message && (
        <div className="card audit-feedback" role="alert">
          <strong>No se pudo cargar Auditoría</strong>
          <p>{message}</p>
          <button className="secondary" onClick={() => void load(appliedFilters, page)}>
            Reintentar
          </button>
        </div>
      )}
      {loading && (
        <div className="card audit-feedback" role="status">
          Cargando historial…
        </div>
      )}
      {!loading && !message && (
        <section className="audit-list" aria-label="Historial de auditoría">
          {items.map((log) => (
            <article className="card audit-card" key={log.id}>
              <header className="audit-event-header">
                <div className="audit-event-context">
                  <time>{dateTime(log.createdAt)}</time>
                  <span>
                    Realizado por <strong>{log.actor.username}</strong>
                  </span>
                </div>
                <div className="audit-entity">
                  <strong>{formatAuditEntity(log.entityType)}</strong>
                  {log.entityId && (
                    <span title={log.entityId}>ID · {shortAuditId(log.entityId)}</span>
                  )}
                </div>
                <span className={`audit-action-badge ${auditActionTone(log.action)}`}>
                  {formatAuditAction(log.action)}
                </span>
              </header>
              <EventMetadata log={log} />
              <Changes log={log} />
              {log.reason && (
                <section className="audit-reason">
                  <span>Motivo</span>
                  <p>{log.reason}</p>
                </section>
              )}
            </article>
          ))}
          {!items.length && (
            <div className="card audit-empty">
              <strong>No hay movimientos de auditoría</strong>
              <p>No se encontraron modificaciones para los filtros seleccionados.</p>
              <button className="secondary" onClick={clear}>
                Limpiar filtros
              </button>
            </div>
          )}
        </section>
      )}
      {!loading && !message && total > 0 && (
        <nav className="audit-pagination" aria-label="Paginación de auditoría">
          <span>
            Página {page} de {pageCount} · {total} movimientos
          </span>
          <div>
            <button
              className="secondary"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </button>
            <button
              className="secondary"
              disabled={page >= pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
