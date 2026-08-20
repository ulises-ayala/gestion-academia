'use client';

import type { StudentDto } from '@academy/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { StudentForm } from '../../../components/student-form';
import { ApiClientError, apiRequest } from '../../../lib/api-client';
import { calculateAge, formatDate } from '../../../lib/dates';

const futureSections = ['Clases', 'Cuotas', 'Pagos', 'Descuentos', 'Asistencias'];

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<StudentDto | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setMessage('');
    try { setStudent(await apiRequest<StudentDto>(`/students/${id}`)); }
    catch (error) { setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cargar el alumno'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus() {
    if (!student) return;
    if (student.status === 'ACTIVE' && !window.confirm('¿Desactivar este alumno? Sus datos se conservarán.')) return;
    setMessage('');
    try {
      const updated = await apiRequest<StudentDto>(student.status === 'ACTIVE' ? `/students/${student.id}` : `/students/${student.id}/reactivate`, { method: student.status === 'ACTIVE' ? 'DELETE' : 'POST' });
      setStudent(updated);
    } catch (error) { setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cambiar el estado'); }
  }

  if (loading) return <p>Cargando ficha…</p>;
  if (!student) return <section className="card"><h1>Alumno no disponible</h1><p>{message}</p><Link className="text-link" href="/students">Volver al listado</Link></section>;
  const age = calculateAge(student.birthDate);

  return <>
    <div className="page-heading"><div><Link className="back-link" href="/students">← Volver al listado</Link><p className="eyebrow">Ficha del alumno</p><h1>{student.firstName} {student.lastName}</h1><span className={`status ${student.status.toLowerCase()}`}>{student.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span></div><div className="actions"><button className="secondary" onClick={() => setEditing((value) => !value)}>{editing ? 'Cerrar edición' : 'Editar datos'}</button><button className={student.status === 'ACTIVE' ? 'danger-button' : ''} onClick={() => void changeStatus()}>{student.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}</button></div></div>
    {message && <p className="message" role="alert">{message}</p>}
    {editing && <section className="card"><h2>Editar datos personales</h2><StudentForm student={student} onSaved={(updated) => { setStudent(updated); setEditing(false); setMessage('Cambios guardados correctamente'); }} onCancel={() => setEditing(false)} /></section>}
    <section className="card"><h2>Datos personales</h2><dl className="detail-grid">
      <div><dt>DNI</dt><dd>{student.dni}</dd></div><div><dt>Edad</dt><dd>{age === null ? '—' : `${age} años`}</dd></div><div><dt>Fecha de nacimiento</dt><dd>{formatDate(student.birthDate)}</dd></div>
      <div><dt>Teléfono</dt><dd>{student.phone ?? '—'}</dd></div><div><dt>Correo</dt><dd>{student.email ?? '—'}</dd></div><div><dt>Domicilio</dt><dd>{student.address ?? '—'}</dd></div><div><dt>Fecha de alta</dt><dd>{formatDate(student.joinedAt)}</dd></div>
    </dl></section>
    <section className="future-grid">{futureSections.map((section) => <article className="card future-card" key={section}><h2>{section}</h2><p>Esta sección se habilitará en una etapa futura.</p></article>)}</section>
  </>;
}
