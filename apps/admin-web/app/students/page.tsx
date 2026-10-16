'use client';

import type { StudentListDto, StudentStatusDto } from '@academy/contracts';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { StudentsNavigation } from '../../components/students-navigation';
import { FilterToolbar, Pagination, Table, Tabs } from '../../components/ui/data-display';
import { Badge, EmptyState, Skeleton } from '../../components/ui/feedback';
import { PageHeader } from '../../components/ui/page-header';
import { PageContainer } from '../../components/ui/page-container';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { studentStatusFromSearch } from '../../lib/contextual-filters';
import { calculateAge, formatDate } from '../../lib/dates';
import { formatStudentName, formatStudentPhone } from '../../lib/student-presentation';

type StatusFilter = '' | StudentStatusDto;
const pageSize = 25;

export default function StudentsPage() {
  const [result, setResult] = useState<StudentListDto>({ items: [], total: 0, page: 1, pageSize });
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>(() =>
    typeof window === 'undefined' ? '' : studentStatusFromSearch(window.location.search),
  );
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
  const resultDescription = `${result.total} alumno${result.total === 1 ? '' : 's'} encontrado${result.total === 1 ? '' : 's'}.`;

  return (
    <PageContainer className="students-page" width="wide">
      <PageHeader
        title="Alumnos"
        description={resultDescription}
        actions={
          <Link className="button" href="/students/new">
            Nuevo alumno
          </Link>
        }
      />
      <Tabs aria-label="Secciones de alumnos">
        <StudentsNavigation active="all" />
      </Tabs>
      {status && (
        <div className="context-filter">
          <span>
            Filtro activo: <strong>{status === 'ACTIVE' ? 'Activos' : 'Inactivos'}</strong>
          </span>
          <button className="secondary" onClick={() => setStatus('')} type="button">
            Limpiar filtro
          </button>
        </div>
      )}
      <FilterToolbar onSubmit={search}>
        <label className="ui-filter-search">
          Buscar
          <Search aria-hidden="true" size={16} strokeWidth={1.5} />
          <input
            placeholder="Nombre, apellido, DNI o teléfono"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
          />
        </label>
        <label>
          Estado
          <span className="ui-select-control">
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
            <ChevronDown aria-hidden="true" size={16} strokeWidth={1.5} />
          </span>
        </label>
        <button className="secondary" type="submit">
          Buscar
        </button>
      </FilterToolbar>
      {message && (
        <div className="module-state" role="alert">
          <p>{message}</p>
          <button className="secondary" onClick={() => void load()} type="button">
            Reintentar
          </button>
        </div>
      )}
      {loading ? (
        <div aria-busy="true" className="students-table-loading" role="status">
          <span className="sr-only">Cargando alumnos…</span>
          <Skeleton />
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : message ? null : result.items.length === 0 ? (
        <EmptyState icon={<UsersRound size={22} strokeWidth={1.5} />}>
          <h2>
            {query || status ? 'No hay alumnos con estos filtros.' : 'No hay alumnos registrados.'}
          </h2>
          <p>
            {query || status
              ? 'Probá cambiar la búsqueda o limpiar el filtro.'
              : 'Creá el primer alumno para comenzar.'}
          </p>
        </EmptyState>
      ) : (
        <Table>
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
                  <span className="student-identity">
                    <span aria-hidden="true" className="student-avatar">
                      {`${student.lastName.charAt(0)}${student.firstName.charAt(0)}`.toUpperCase()}
                    </span>
                    <span
                      className="student-name"
                      title={`${student.lastName}, ${student.firstName}`}
                    >
                      {formatStudentName(student.lastName, student.firstName)}
                    </span>
                  </span>
                </td>
                <td data-label="DNI">{student.dni}</td>
                <td
                  className="student-contact"
                  data-label="Contacto"
                  title={student.email || student.phone || '—'}
                >
                  {student.email || (student.phone && formatStudentPhone(student.phone)) || '—'}
                </td>
                <td data-label="Edad">{calculateAge(student.birthDate) ?? '—'}</td>
                <td data-label="Estado">
                  <Badge tone={student.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {student.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className="student-joined" data-label="Fecha de alta">
                  {formatDate(student.joinedAt)}
                </td>
                <td data-label="Acciones">
                  <Link className="student-action" href={`/students/${student.id}`}>
                    Ver ficha <ArrowRight aria-hidden="true" size={14} strokeWidth={1.5} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination aria-label="Paginación de alumnos">
        <button
          className="secondary"
          disabled={page <= 1 || loading}
          onClick={() => setPage((value) => value - 1)}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={14} strokeWidth={1.5} /> Anterior
        </button>
        <span aria-live="polite">
          Página {result.page} de {pageCount}
        </span>
        <button
          className="secondary"
          disabled={page >= pageCount || loading}
          onClick={() => setPage((value) => value + 1)}
          type="button"
        >
          Siguiente <ChevronRight aria-hidden="true" size={14} strokeWidth={1.5} />
        </button>
      </Pagination>
    </PageContainer>
  );
}
