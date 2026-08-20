'use client';

import type { TariffDto } from '@academy/contracts';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { formatDate } from '../../lib/dates';

const emptyForm = { name: '', amount: '40000.00', validFrom: '', validTo: '' };
const money = (value: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));

export default function TariffsPage() {
  const [items, setItems] = useState<readonly TariffDto[]>([]);
  const [editing, setEditing] = useState<TariffDto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => setItems(await apiRequest<TariffDto[]>('/tariffs')), []);
  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await apiRequest(editing ? `/tariffs/${editing.id}` : '/tariffs', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...form, validTo: form.validTo || null }),
      });
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo guardar la tarifa');
    }
  }

  async function toggle(item: TariffDto) {
    if (item.status === 'ACTIVE' && !confirm('¿Desactivar esta tarifa?')) return;
    try {
      await apiRequest(
        item.status === 'ACTIVE' ? `/tariffs/${item.id}` : `/tariffs/${item.id}/reactivate`,
        { method: item.status === 'ACTIVE' ? 'DELETE' : 'POST' },
      );
      await load();
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo cambiar el estado');
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Facturación</p>
          <h1>Tarifas</h1>
          <p className="subtitle">Valores mensuales por clase, con vigencia e historial.</p>
        </div>
      </div>
      <section className="card">
        <h2>{editing ? 'Editar tarifa' : 'Nueva tarifa'}</h2>
        <form className="catalog-form tariff-form" onSubmit={submit}>
          <label>
            Nombre
            <input
              required
              maxLength={120}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label>
            Monto ARS
            <input
              required
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          </label>
          <label>
            Vigente desde
            <input
              required
              type="date"
              value={form.validFrom}
              onChange={(event) => setForm({ ...form, validFrom: event.target.value })}
            />
          </label>
          <label>
            Vigente hasta <span className="optional">opcional</span>
            <input
              type="date"
              value={form.validTo}
              onChange={(event) => setForm({ ...form, validTo: event.target.value })}
            />
          </label>
          <div className="actions">
            <button>Guardar</button>
            {editing && (
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm(emptyForm);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
        {message && <p className="message">{message}</p>}
      </section>
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Monto</th>
                <th>Vigencia</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{money(item.amount)}</td>
                  <td>
                    {formatDate(item.validFrom)} – {formatDate(item.validTo)}
                  </td>
                  <td>{item.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</td>
                  <td className="actions">
                    <button
                      className="secondary"
                      onClick={() => {
                        setEditing(item);
                        setForm({
                          name: item.name,
                          amount: item.amount,
                          validFrom: item.validFrom,
                          validTo: item.validTo ?? '',
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
        </div>
      </section>
    </>
  );
}
