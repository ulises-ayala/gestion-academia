'use client';

import type { StudentListDto, StudentStatusDto } from '@academy/contracts';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { calculateAge, formatDate } from '../../lib/dates';

type StatusFilter = '' | StudentStatusDto;
const pageSize = 25;

export default function StudentsPage() {
  const [result, setResult] = useState<StudentListDto>({ items: [], total: 0, page: 1, pageSize });
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (query) params.set('q', query);
    if (status) params.set('status', status);
    try {
      setResult(await apiRequest<StudentListDto>(`/students?${params}`));
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo consultar la lista');
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(draftQuery.trim());
  }
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Personas</p>
          <h1>Alumnos</h1>
          <p className="subtitle">
            {result.total} alumno{result.total === 1 ? '' : 's'} encontrado
            {result.total === 1 ? '' : 's'}.
          </p>
        </div>
        <Link className="button" href="/students/new">
          Nuevo alumno
        </Link>
      </div>
      <section className="card">
        <form className="filters" onSubmit={search}>
          <label className="search-field">
            Buscar
            <input
              placeholder="Nombre, apellido, DNI o teléfono"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
            />
          </label>
          <label>
            Estado
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
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
            <h2>No se encontraron alumnos</h2>
            <p>Probá cambiar la búsqueda o el filtro.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>DNI</th>
                  <th>Contacto</th>
                  <th>Edad</th>
                  <th>Estado</th>
                  <th>Fecha de alta</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((student) => (
                  <tr key={student.id}>
                    <td data-label="Alumno">
                      <strong>
                        {student.lastName}, {student.firstName}
                      </strong>
                    </td>
                    <td data-label="DNI">{student.dni}</td>
                    <td data-label="Contacto">{student.email || student.phone || '—'}</td>
                    <td data-label="Edad">{calculateAge(student.birthDate) ?? '—'}</td>
                    <td data-label="Estado">
                      <span className={`status ${student.status.toLowerCase()}`}>
                        {student.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td data-label="Fecha de alta">{formatDate(student.joinedAt)}</td>
                    <td data-label="Acciones">
                      <Link className="text-link" href={`/students/${student.id}`}>
                        Ver ficha
                      </Link>
                    </td>
                  </tr>
                ))}
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
