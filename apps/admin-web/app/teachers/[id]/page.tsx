'use client';
import type { TeacherDto } from '@academy/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TeacherForm } from '../../../components/teacher-form';
import { apiRequest } from '../../../lib/api-client';
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<TeacherDto | null>(null);
  const [edit, setEdit] = useState(false);
  useEffect(() => {
    void apiRequest<TeacherDto>(`/teachers/${id}`).then(setItem);
  }, [id]);
  if (!item) return <p>Cargando…</p>;
  async function toggle() {
    if (!item) return;
    if (item.status === 'ACTIVE' && !confirm('¿Desactivar este profesor?')) return;
    setItem(
      await apiRequest<TeacherDto>(
        item.status === 'ACTIVE' ? `/teachers/${item.id}` : `/teachers/${item.id}/reactivate`,
        { method: item.status === 'ACTIVE' ? 'DELETE' : 'POST' },
      ),
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <Link className="back-link" href="/teachers">
            ← Volver
          </Link>
          <h1>
            {item.firstName} {item.lastName}
          </h1>
          <span className={`status ${item.status.toLowerCase()}`}>
            {item.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => setEdit(!edit)}>
            Editar
          </button>
          <button onClick={() => void toggle()}>
            {item.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}
          </button>
        </div>
      </div>
      {edit && (
        <section className="card">
          <TeacherForm
            teacher={item}
            onSaved={(value) => {
              setItem(value);
              setEdit(false);
            }}
            onCancel={() => setEdit(false)}
          />
        </section>
      )}
      <section className="card">
        <h2>Datos personales</h2>
        <dl className="detail-grid">
          <div>
            <dt>DNI</dt>
            <dd>{item.dni}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>{item.phone ?? '—'}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{item.email ?? '—'}</dd>
          </div>
          <div>
            <dt>Domicilio</dt>
            <dd>{item.address ?? '—'}</dd>
          </div>
        </dl>
      </section>
      <section className="card future-card">
        <h2>Clases</h2>
        <p>Las clases asignadas se mostrarán aquí en una etapa posterior.</p>
      </section>
    </>
  );
}
