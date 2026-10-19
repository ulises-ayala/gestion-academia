'use client';

import type { ClassDto, ClassListDto } from '@academy/contracts';
import { CalendarDays, List, RotateCw, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClientError, apiRequest } from '../../../lib/api-client';
import { dayLabels } from '../../../lib/offering';
import {
  agendaFilterOptions,
  buildWeeklyAgenda,
  businessWeekDay,
  emptyAgendaFilters,
  type AgendaEntry,
  type AgendaFilters,
} from '../../../lib/weekly-agenda';

const PAGE_SIZE = 100;

/** Trae todas las clases activas, página por página. */
async function loadActiveClasses(): Promise<ClassDto[]> {
  const items: ClassDto[] = [];
  for (let page = 1; ; page++) {
    const result = await apiRequest<ClassListDto>(
      `/classes?status=ACTIVE&page=${page}&pageSize=${PAGE_SIZE}`,
    );
    items.push(...result.items);
    if (items.length >= result.total || result.items.length === 0) return items;
  }
}

const occupancyLabel: Readonly<Record<AgendaEntry['occupancy'], string>> = {
  full: 'Completa',
  high: 'Casi completa',
  open: 'Con lugar',
};

export default function WeeklyAgendaPage() {
  const [classes, setClasses] = useState<ClassDto[] | null>(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<AgendaFilters>(emptyAgendaFilters);
  const today = useMemo(() => businessWeekDay(new Date()), []);
  const [selectedDay, setSelectedDay] = useState(today);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setClasses(await loadActiveClasses());
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : 'No se pudo cargar la agenda.');
    }
  }, []);
  useEffect(() => void load(), [load]);

  const options = useMemo(() => agendaFilterOptions(classes ?? []), [classes]);
  const rooms = useMemo(
    () =>
      [...new Map(options.rooms.map((room) => [room.id, room])).values()]
        .filter((room) => !filters.branchId || room.branchId === filters.branchId)
        .sort((left, right) => left.name.localeCompare(right.name, 'es')),
    [options.rooms, filters.branchId],
  );
  const week = useMemo(() => buildWeeklyAgenda(classes ?? [], filters), [classes, filters]);
  const total = week.reduce((sum, day) => sum + day.entries.length, 0);
  const activeFilters = Object.values(filters).some(Boolean);
  const setFilter = (key: keyof AgendaFilters, value: string) =>
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'branchId' ? { roomId: '' } : {}),
    }));

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Oferta académica</p>
          <h1>Agenda semanal</h1>
          <p className="subtitle">Todas las clases activas por día, con salón, profesor y cupo.</p>
        </div>
        <Link className="button secondary" href="/classes">
          <List aria-hidden="true" size={16} strokeWidth={1.75} />
          Ver listado
        </Link>
      </div>

      <button
        aria-controls="agenda-filters"
        aria-expanded={filtersOpen}
        className="secondary agenda-filters-toggle"
        onClick={() => setFiltersOpen((value) => !value)}
        type="button"
      >
        <SlidersHorizontal aria-hidden="true" size={16} strokeWidth={1.75} />
        Filtros
        {activeFilters && (
          <span className="agenda-filters-count">
            {Object.values(filters).filter(Boolean).length}
          </span>
        )}
      </button>
      <section
        aria-label="Filtros de la agenda"
        className={`card agenda-filters ${filtersOpen ? 'is-open' : ''}`}
        id="agenda-filters"
      >
        <label>
          Sucursal
          <select value={filters.branchId} onChange={(e) => setFilter('branchId', e.target.value)}>
            <option value="">Todas</option>
            {options.branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Salón
          <select value={filters.roomId} onChange={(e) => setFilter('roomId', e.target.value)}>
            <option value="">Todos</option>
            {rooms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Profesor
          <select
            value={filters.teacherId}
            onChange={(e) => setFilter('teacherId', e.target.value)}
          >
            <option value="">Todos</option>
            {options.teachers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Danza
          <select
            value={filters.danceTypeId}
            onChange={(e) => setFilter('danceTypeId', e.target.value)}
          >
            <option value="">Todas</option>
            {options.danceTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {activeFilters && (
          <button
            className="secondary agenda-clear"
            onClick={() => setFilters(emptyAgendaFilters)}
            type="button"
          >
            Limpiar filtros
          </button>
        )}
      </section>

      {error ? (
        <section className="card module-state" role="alert">
          <p>{error}</p>
          <button className="secondary" onClick={() => void load()} type="button">
            <RotateCw aria-hidden="true" size={14} strokeWidth={1.75} />
            Reintentar
          </button>
        </section>
      ) : classes === null ? (
        <section aria-busy="true" className="card module-state" role="status">
          Cargando agenda…
        </section>
      ) : total === 0 ? (
        <section className="card module-state">
          <CalendarDays aria-hidden="true" size={22} strokeWidth={1.5} />
          <p>
            {activeFilters
              ? 'No hay clases con estos filtros.'
              : 'Todavía no hay clases activas con horarios.'}
          </p>
        </section>
      ) : (
        <>
          <div aria-label="Día" className="agenda-day-tabs" role="tablist">
            {week.map((day) => (
              <button
                aria-selected={selectedDay === day.day}
                className={`agenda-day-tab ${selectedDay === day.day ? 'is-selected' : ''}`}
                key={day.day}
                onClick={() => setSelectedDay(day.day)}
                role="tab"
                type="button"
              >
                {dayLabels[day.day].slice(0, 3)}
                <small>{day.entries.length}</small>
              </button>
            ))}
          </div>
          <div className="agenda-week">
            {week.map((day) => (
              <section
                aria-labelledby={`agenda-${day.day}`}
                className={`agenda-day ${day.day === today ? 'is-today' : ''} ${selectedDay === day.day ? 'is-selected' : ''}`}
                key={day.day}
              >
                <header className="agenda-day-header">
                  <h2 id={`agenda-${day.day}`}>{dayLabels[day.day]}</h2>
                  {day.day === today && <span className="agenda-today-badge">Hoy</span>}
                </header>
                {day.entries.length === 0 ? (
                  <p className="agenda-day-empty">Sin clases</p>
                ) : (
                  <ul className="agenda-entries">
                    {day.entries.map((entry) => (
                      <li key={entry.key}>
                        <Link className="agenda-entry" href={`/classes/${entry.classId}`}>
                          <span className="agenda-entry-time">
                            {entry.startTime}–{entry.endTime}
                          </span>
                          <strong>{entry.className}</strong>
                          <span className="agenda-entry-meta">
                            {entry.danceType}
                            {entry.level ? ` · Nivel ${entry.level}` : ''}
                          </span>
                          <span className="agenda-entry-meta">Prof. {entry.teacher}</span>
                          <span className="agenda-entry-meta">
                            {entry.room}
                            {options.branches.length > 1 ? ` · ${entry.branch}` : ''}
                          </span>
                          <span className={`agenda-occupancy is-${entry.occupancy}`}>
                            <span className="agenda-occupancy-bar" aria-hidden="true">
                              <span
                                style={{
                                  width: `${Math.min(100, entry.capacity ? (entry.enrolled / entry.capacity) * 100 : 0)}%`,
                                }}
                              />
                            </span>
                            {entry.enrolled}/{entry.capacity} · {occupancyLabel[entry.occupancy]}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
