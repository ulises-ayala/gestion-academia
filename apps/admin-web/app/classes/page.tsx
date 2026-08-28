'use client';
import type { BranchDto, ClassListDto, DanceTypeDto, TeacherListDto } from '@academy/contracts';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api-client';
import { dayLabels } from '../../lib/offering';
import { PermissionGate } from '../../components/permission-gate';
export default function Page() {
  const [data, setData] = useState<ClassListDto>({ items: [], total: 0, page: 1, pageSize: 25 });
  const [options, setOptions] = useState<{
    dances: readonly DanceTypeDto[];
    teachers: TeacherListDto['items'];
    branches: readonly BranchDto[];
  }>({ dances: [], teachers: [], branches: [] });
  const [draft, setDraft] = useState('');
  const [filters, setFilters] = useState({
    q: '',
    status: '',
    danceTypeId: '',
    teacherId: '',
    branchId: '',
  });
  const [page, setPage] = useState(1);
  useEffect(() => {
    void Promise.all([
      apiRequest<DanceTypeDto[]>('/dance-types?status=ACTIVE'),
      apiRequest<TeacherListDto>('/teachers?status=ACTIVE&pageSize=100'),
      apiRequest<BranchDto[]>('/branches?status=ACTIVE'),
    ]).then(([dances, teachers, branches]) =>
      setOptions({ dances, teachers: teachers.items, branches }),
    );
  }, []);
  const load = useCallback(async () => {
    const p = new URLSearchParams({ page: String(page), pageSize: '25' });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) p.set(key, value);
    });
    setData(await apiRequest<ClassListDto>(`/classes?${p}`));
  }, [filters, page]);
  useEffect(() => {
    void load();
  }, [load]);
  function search(e: FormEvent) {
    e.preventDefault();
    setFilters({ ...filters, q: draft.trim() });
    setPage(1);
  }
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Oferta académica</p>
          <h1>Clases</h1>
        </div>
        <PermissionGate permission="offering:manage">
          <Link className="button" href="/classes/new">
            Nueva clase
          </Link>
        </PermissionGate>
      </div>
      <section className="card">
        <form className="class-filters" onSubmit={search}>
          <label>
            Buscar
            <input value={draft} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <label>
            Estado
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="ACTIVE">Activas</option>
              <option value="INACTIVE">Inactivas</option>
            </select>
          </label>
          <label>
            Danza
            <select
              value={filters.danceTypeId}
              onChange={(e) => setFilters({ ...filters, danceTypeId: e.target.value })}
            >
              <option value="">Todas</option>
              {options.dances.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Profesor
            <select
              value={filters.teacherId}
              onChange={(e) => setFilters({ ...filters, teacherId: e.target.value })}
            >
              <option value="">Todos</option>
              {options.teachers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.lastName}, {x.firstName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sucursal
            <select
              value={filters.branchId}
              onChange={(e) => setFilters({ ...filters, branchId: e.target.value })}
            >
              <option value="">Todas</option>
              {options.branches.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <button>Aplicar</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Clase</th>
                <th>Danza</th>
                <th>Profesor</th>
                <th>Horarios</th>
                <th>Cupo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <br />
                    {item.level ?? '—'}
                  </td>
                  <td>{item.danceType.name}</td>
                  <td>
                    {item.teacher.firstName} {item.teacher.lastName}
                  </td>
                  <td>
                    {item.schedules
                      .map(
                        (s) =>
                          `${dayLabels[s.dayOfWeek]} ${s.startTime}–${s.endTime} · ${s.room.branch.name}/${s.room.name}`,
                      )
                      .join(' | ')}
                  </td>
                  <td>
                    {item.activeEnrollmentCount ?? 0} / {item.capacity}
                  </td>
                  <td>
                    <span className={`status ${item.status.toLowerCase()}`}>
                      {item.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td>
                    <Link className="text-link" href={`/classes/${item.id}`}>
                      Ver
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
            {page} / {pages}
          </span>
          <button className="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Siguiente
          </button>
        </div>
      </section>
    </>
  );
}
