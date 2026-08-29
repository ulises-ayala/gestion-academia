'use client';
import type { TeacherListDto } from '@academy/contracts';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api-client';
export default function TeachersPage() {
  const [data, setData] = useState<TeacherListDto>({ items: [], total: 0, page: 1, pageSize: 25 });
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    setData(await apiRequest<TeacherListDto>(`/teachers?${params}`));
  }, [q, status, page]);
  useEffect(() => {
    void load();
  }, [load]);
  const search = (event: FormEvent) => {
    event.preventDefault();
    setQ(draft.trim());
    setPage(1);
  };
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Personas</p>
          <h1>Profesores</h1>
          <p className="subtitle">{data.total} profesores encontrados.</p>
        </div>
        <Link className="button" href="/teachers/new">
          Nuevo profesor
        </Link>
      </div>
      <section className="card">
        <form className="filters" onSubmit={search}>
          <label>
            Buscar
            <input
              placeholder="Nombre, apellido, DNI o teléfono"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <label>
            Estado
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
          </label>
          <button>Buscar</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Profesor</th>
                <th>DNI</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Profesor">
                    {item.lastName}, {item.firstName}
                  </td>
                  <td data-label="DNI">{item.dni}</td>
                  <td data-label="Contacto">{item.email || item.phone || '—'}</td>
                  <td data-label="Estado">
                    <span className={`status ${item.status.toLowerCase()}`}>
                      {item.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td data-label="Acción">
                    <Link className="text-link" href={`/teachers/${item.id}`}>
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button className="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>
            Página {page} de {pages}
          </span>
          <button className="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Siguiente
          </button>
        </div>
      </section>
    </>
  );
}
