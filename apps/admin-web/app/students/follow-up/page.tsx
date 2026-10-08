'use client';

import type { StudentFollowUpItemDto, StudentFollowUpResponseDto } from '@academy/contracts';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../../components/auth-provider';
import { EndEnrollmentModal } from '../../../components/end-enrollment-modal';
import { FollowUpEmpty, FollowUpTable } from '../../../components/student-follow-up';
import { apiRequest } from '../../../lib/api-client';

export default function StudentFollowUpPage() {
  const { can } = useAuth();
  const [result, setResult] = useState<StudentFollowUpResponseDto | null>(null);
  const [draft, setDraft] = useState({ q: '', classId: '', minAbsences: '3' });
  const [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState('');
  const [target, setTarget] = useState<StudentFollowUpItemDto | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(false);
    const query = new URLSearchParams({ ...filters, page: String(page) });
    void apiRequest<StudentFollowUpResponseDto>(`/students/follow-up?${query}`)
      .then((data) => {
        if (!current) return;
        if (page > 1 && !data.items.length) {
          setPage(1);
          return;
        }
        setResult(data);
      })
      .catch(() => {
        if (current) setError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [filters, page, refresh]);
  function apply(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setFilters({ ...draft, q: draft.q.trim() });
  }
  if (!can('students:manage')) return <p>No tenés permisos para consultar alumnos.</p>;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Alumnos</p>
          <h1 ref={heading} tabIndex={-1}>
            Seguimiento de alumnos
          </h1>
          <p className="subtitle">Alumnos con ausencias consecutivas que conviene revisar.</p>
        </div>
        <Link className="button secondary" href="/students">
          Volver a alumnos
        </Link>
      </div>
      {notice && <p role="status">{notice}</p>}
      <section className="card follow-up-stack">
        <form className="follow-up-filters" onSubmit={apply}>
          <label>
            Buscar alumno
            <input
              placeholder="Nombre, apellido o DNI"
              maxLength={100}
              value={draft.q}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
            />
          </label>
          <label>
            Actividad
            <select
              value={draft.classId}
              onChange={(e) => setDraft({ ...draft, classId: e.target.value })}
            >
              <option value="">Todas</option>
              {result?.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ausencias consecutivas
            <select
              value={draft.minAbsences}
              onChange={(e) => setDraft({ ...draft, minAbsences: e.target.value })}
            >
              <option value="3">3 o más</option>
              <option value="4">4 o más</option>
              <option value="5">5 o más</option>
            </select>
          </label>
          <button>Aplicar filtros</button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const cleared = { q: '', classId: '', minAbsences: '3' };
              setDraft(cleared);
              setFilters(cleared);
              setPage(1);
            }}
          >
            Limpiar
          </button>
        </form>
        {loading ? (
          <p role="status">Cargando seguimiento de alumnos…</p>
        ) : error ? (
          <div role="alert">
            <p>No pudimos cargar el seguimiento de alumnos.</p>
            <button type="button" onClick={() => setRefresh((v) => v + 1)}>
              Reintentar
            </button>
          </div>
        ) : (
          result && (
            <>
              <p>
                {result.students} alumnos requieren seguimiento · {result.total} casos por
                inscripción. Sólo se consideran asistencias registradas.
              </p>
              {result.items.length ? (
                <FollowUpTable
                  items={result.items}
                  canEnd={can('enrollments:manage')}
                  onEnd={setTarget}
                />
              ) : (
                <FollowUpEmpty globalTotal={result.globalTotal} />
              )}
              {result.total > 0 && (
                <nav className="follow-up-actions" aria-label="Paginación de seguimiento">
                  <button
                    className="secondary"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </button>
                  <span>
                    Página {page} de {Math.max(1, Math.ceil(result.total / result.pageSize))}
                  </span>
                  <button
                    className="secondary"
                    disabled={page * result.pageSize >= result.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </button>
                </nav>
              )}
            </>
          )
        )}
      </section>
      {target && (
        <EndEnrollmentModal
          target={target}
          onClose={() => setTarget(null)}
          onEnded={() => {
            setTarget(null);
            setNotice('Inscripción finalizada.');
            setRefresh((v) => v + 1);
            requestAnimationFrame(() => heading.current?.focus());
          }}
        />
      )}
    </>
  );
}
