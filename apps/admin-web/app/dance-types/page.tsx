'use client';
import type { DanceTypeDto } from '@academy/contracts';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '../../lib/api-client';
export default function Page() {
  const [items, setItems] = useState<readonly DanceTypeDto[]>([]);
  const [editing, setEditing] = useState<DanceTypeDto | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [message, setMessage] = useState('');
  const load = useCallback(
    async () => setItems(await apiRequest<DanceTypeDto[]>('/dance-types')),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await apiRequest(editing ? `/dance-types/${editing.id}` : '/dance-types', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      setEditing(null);
      setForm({ name: '', description: '' });
      await load();
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo guardar');
    }
  }
  async function toggle(item: DanceTypeDto) {
    if (item.status === 'ACTIVE' && !confirm('¿Desactivar este tipo de danza?')) return;
    try {
      await apiRequest(
        item.status === 'ACTIVE' ? `/dance-types/${item.id}` : `/dance-types/${item.id}/reactivate`,
        { method: item.status === 'ACTIVE' ? 'DELETE' : 'POST' },
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cambiar el estado');
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Oferta</p>
          <h1>Tipos de danza</h1>
        </div>
      </div>
      <section className="card">
        <h2>{editing ? 'Editar tipo' : 'Nuevo tipo'}</h2>
        <form className="catalog-form" onSubmit={submit}>
          <label>
            Nombre
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Descripción
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <button>Guardar</button>
        </form>
        {message && <p className="message">{message}</p>}
      </section>
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.description ?? '—'}</td>
                <td>
                  <span className={`status ${item.status.toLowerCase()}`}>
                    {item.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditing(item);
                      setForm({ name: item.name, description: item.description ?? '' });
                    }}
                  >
                    Editar
                  </button>
                  <button onClick={() => void toggle(item)}>
                    {item.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
