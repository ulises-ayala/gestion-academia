'use client';
import type { BranchDto } from '@academy/contracts';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '../../lib/api-client';
export default function Page() {
  const [items, setItems] = useState<readonly BranchDto[]>([]);
  const [editing, setEditing] = useState<BranchDto | null>(null);
  const [form, setForm] = useState({ name: '', address: '' });
  const [message, setMessage] = useState('');
  const load = useCallback(async () => setItems(await apiRequest<BranchDto[]>('/branches')), []);
  useEffect(() => {
    void load();
  }, [load]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await apiRequest(editing ? `/branches/${editing.id}` : '/branches', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      setEditing(null);
      setForm({ name: '', address: '' });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error');
    }
  }
  async function toggle(item: BranchDto) {
    if (item.status === 'ACTIVE' && !confirm('¿Desactivar esta sucursal?')) return;
    try {
      await apiRequest(
        item.status === 'ACTIVE' ? `/branches/${item.id}` : `/branches/${item.id}/reactivate`,
        { method: item.status === 'ACTIVE' ? 'DELETE' : 'POST' },
      );
      await load();
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'Error');
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Espacios</p>
          <h1>Sucursales</h1>
        </div>
      </div>
      <section className="card">
        <h2>{editing ? 'Editar sucursal' : 'Nueva sucursal'}</h2>
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
            Dirección
            <input
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
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
              <th>Sucursal</th>
              <th>Dirección</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.address}</td>
                <td>{item.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</td>
                <td className="actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditing(item);
                      setForm({ name: item.name, address: item.address });
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
