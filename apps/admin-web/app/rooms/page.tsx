'use client';
import type { BranchDto, RoomDto } from '@academy/contracts';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '../../lib/api-client';
export default function Page() {
  const [items, setItems] = useState<readonly RoomDto[]>([]);
  const [branches, setBranches] = useState<readonly BranchDto[]>([]);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<RoomDto | null>(null);
  const [form, setForm] = useState({ name: '', capacity: 1, branchId: '' });
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const suffix = filter ? `?branchId=${filter}` : '';
    setItems(await apiRequest<RoomDto[]>(`/rooms${suffix}`));
  }, [filter]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void apiRequest<BranchDto[]>('/branches?status=ACTIVE').then((data) => {
      setBranches(data);
      setForm((current) => ({ ...current, branchId: current.branchId || data[0]?.id || '' }));
    });
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await apiRequest(editing ? `/rooms/${editing.id}` : '/rooms', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      setEditing(null);
      setForm({ name: '', capacity: 1, branchId: branches[0]?.id ?? '' });
      await load();
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo guardar');
    }
  }
  async function toggle(item: RoomDto) {
    if (item.status === 'ACTIVE' && !confirm('¿Desactivar este salón?')) return;
    try {
      await apiRequest(
        item.status === 'ACTIVE' ? `/rooms/${item.id}` : `/rooms/${item.id}/reactivate`,
        { method: item.status === 'ACTIVE' ? 'DELETE' : 'POST' },
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error');
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Espacios</p>
          <h1>Salones</h1>
        </div>
        <label>
          Filtrar por sucursal
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Todas</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <section className="card">
        <h2>{editing ? 'Editar salón' : 'Nuevo salón'}</h2>
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
            Capacidad
            <input
              required
              type="number"
              min="1"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            />
          </label>
          <label>
            Sucursal
            <select
              required
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <button>Guardar</button>
        </form>
        {message && <p className="message">{message}</p>}
      </section>
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Salón</th>
              <th>Sucursal</th>
              <th>Capacidad</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.branch.name}</td>
                <td>{item.capacity}</td>
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
                      setForm({
                        name: item.name,
                        capacity: item.capacity,
                        branchId: item.branchId,
                      });
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
