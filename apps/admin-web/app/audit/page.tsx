'use client';
import type { AuditLogDto, AuditLogListDto } from '@academy/contracts';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api-client';
const labels: Record<string, string> = {
  UPDATE: 'Actualización',
  STATUS_CHANGE: 'Cambio de estado',
  VOID: 'Anulación',
  END: 'Finalización',
  CORRECTION: 'Corrección',
  ROLE_CHANGE: 'Cambio de rol',
};
const value = (item: unknown) => (item == null || item === '' ? '—' : String(item));
const dateTime = (date: string) =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Buenos_Aires',
  }).format(new Date(date));
function Changes({ log }: Readonly<{ log: AuditLogDto }>) {
  const keys = [...new Set([...Object.keys(log.before ?? {}), ...Object.keys(log.after ?? {})])];
  return keys.length ? (
    <dl className="audit-changes">
      {keys.map((key) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>
            <span>{value(log.before?.[key])}</span>
            <span>→</span>
            <span>{value(log.after?.[key])}</span>
          </dd>
        </div>
      ))}
    </dl>
  ) : (
    <p>Sin detalle de campos.</p>
  );
}
export default function AuditPage() {
  const empty = { entityType: '', action: '', actorUserId: '', from: '', to: '' };
  const [items, setItems] = useState<readonly AuditLogDto[]>([]);
  const [filters, setFilters] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(async (query: typeof empty) => {
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams(Object.entries(query).filter(([, item]) => item));
      setItems((await apiRequest<AuditLogListDto>(`/audit-logs?${params}`)).items);
    } catch {
      setMessage('No se pudo cargar la auditoría.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load(empty);
  }, [load]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void load(filters);
  };
  const clear = () => {
    setFilters(empty);
    void load(empty);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Auditoría</h1>
          <p className="subtitle">Historial inmutable de modificaciones sensibles.</p>
        </div>
      </div>
      <section className="card">
        <form className="filters audit-filters" onSubmit={submit}>
          {(['entityType', 'action', 'actorUserId'] as const).map((field) => (
            <label key={field}>
              {field === 'entityType' ? 'Entidad' : field === 'action' ? 'Acción' : 'Usuario'}
              <input
                value={filters[field]}
                onChange={(event) => setFilters({ ...filters, [field]: event.target.value })}
              />
            </label>
          ))}
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
          <button disabled={loading}>{loading ? 'Aplicando…' : 'Aplicar'}</button>
          <button className="secondary" type="button" onClick={clear}>
            Limpiar
          </button>
        </form>
      </section>
      {message && (
        <p className="message" role="alert">
          {message}
        </p>
      )}
      <section className="audit-list">
        {items.map((log) => (
          <article className="card audit-card" key={log.id}>
            <header>
              <div>
                <time>{dateTime(log.createdAt)}</time>
                <strong>{log.actor.username}</strong>
              </div>
              <span className="status active">{labels[log.action] ?? log.action}</span>
            </header>
            <p>
              <strong>{log.entityType}</strong>
              {log.entityId ? ` · ${log.entityId}` : ''}
            </p>
            <Changes log={log} />
            <p>
              <strong>Motivo:</strong> {log.reason ?? '—'}
            </p>
          </article>
        ))}
        {!loading && !items.length && (
          <p className="card empty-state">No hay eventos para los filtros seleccionados.</p>
        )}
      </section>
    </>
  );
}
