'use client';
import type {
  BranchDto,
  ClassListDto,
  DanceTypeDto,
  RoomDto,
  TeacherListDto,
} from '@academy/contracts';
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

  const [availableRooms, setAvailableRooms] = useState<readonly RoomDto[]>([]);
  const [draft, setDraft] = useState('');
  const [filters, setFilters] = useState({
    q: '',
    status: '',
    danceTypeId: '',
    teacherId: '',
    branchId: '',
    roomId: '',
  });
  const [page, setPage] = useState(1);

  // Cargar opciones fijas iniciales
  useEffect(() => {
    void Promise.all([
      apiRequest<DanceTypeDto[]>('/dance-types?status=ACTIVE'),
      apiRequest<TeacherListDto>('/teachers?status=ACTIVE&pageSize=100'),
      apiRequest<BranchDto[]>('/branches?status=ACTIVE'),
    ]).then(([dances, teachers, branches]) =>
      setOptions({ dances, teachers: teachers.items, branches }),
    );
  }, []);

  // Cargar salones en cascada al cambiar la sucursal
  useEffect(() => {
    if (!filters.branchId) {
      setAvailableRooms([]);
      setFilters((prev) => (prev.roomId ? { ...prev, roomId: '' } : prev));
      return;
    }

    void apiRequest<RoomDto[]>(`/rooms?status=ACTIVE&branchId=${filters.branchId}`)
      .then((rooms) => {
        setAvailableRooms(rooms);
      })
      .catch(() => {
        setAvailableRooms([]);
      });
  }, [filters.branchId]);

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
    setFilters((prev) => ({ ...prev, q: draft.trim() }));
    setPage(1);
  }

  function handleBranchChange(newBranchId: string) {
    setFilters((prev) => ({
      ...prev,
      branchId: newBranchId,
      roomId: '', // Resetear salón al cambiar sucursal
    }));
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Oferta académica</p>
          <h1>Clases</h1>
        </div>
        <div className="page-heading-actions">
          <Link className="button secondary" href="/classes/agenda">
            Agenda semanal
          </Link>
          <PermissionGate permission="offering:manage">
            <Link className="button" href="/classes/new">
              Nueva clase
            </Link>
          </PermissionGate>
        </div>
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
            <select value={filters.branchId} onChange={(e) => handleBranchChange(e.target.value)}>
              <option value="">Todas</option>
              {options.branches.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>

          {/* FILTRO EN CASCADA: Salón */}
          <label>
            Salón
            <select
              value={filters.roomId}
              disabled={!filters.branchId || availableRooms.length === 0}
              onChange={(e) => setFilters({ ...filters, roomId: e.target.value })}
            >
              <option value="">
                {!filters.branchId
                  ? 'Elija sucursal'
                  : availableRooms.length === 0
                    ? 'Sin salones'
                    : 'Todos'}
              </option>
              {availableRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>

          <button>Aplicar</button>
        </form>
        <div className="table-wrap">
          <table className="classes-table">
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
                  <td data-label="Clase">
                    <span className="class-name-cell">
                      <strong>{item.name}</strong>
                      <small>{item.level ? `Nivel ${item.level}` : 'Sin nivel'}</small>
                    </span>
                  </td>
                  <td data-label="Danza">{item.danceType.name}</td>
                  <td data-label="Profesor">
                    {item.teacher.firstName} {item.teacher.lastName}
                  </td>
                  <td data-label="Horarios">
                    <div className="class-schedule-list">
                      {item.schedules.length === 0 ? (
                        <span className="class-schedule-empty">Sin horarios</span>
                      ) : (
                        item.schedules.map((s) => (
                          <div className="class-schedule-item" key={s.id}>
                            <span className="class-schedule-day">
                              {dayLabels[s.dayOfWeek]?.slice(0, 3) ?? s.dayOfWeek}
                            </span>
                            <span className="class-schedule-time">
                              {s.startTime}–{s.endTime}
                            </span>
                            <span className="class-schedule-room">{s.room.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                  <td data-label="Cupo">
                    {item.activeEnrollmentCount ?? 0} / {item.capacity}
                  </td>
                  <td data-label="Estado">
                    <span className={`status ${item.status.toLowerCase()}`}>
                      {item.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td data-label="Acción">
                    <Link className="text-link classes-table-action" href={`/classes/${item.id}`}>
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
