'use client';

import type { ClassListDto, TariffDto } from '@academy/contracts';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { formatDate } from '../../lib/dates';
import { PermissionGate } from '../../components/permission-gate';

const emptyForm = { classId: '', name: '', amount: '40000.00', validFrom: '', validTo: '' };
const money = (value: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));

export default function TariffsPage() {
  const [items, setItems] = useState<readonly TariffDto[]>([]);
  const [classes, setClasses] = useState<ClassListDto['items']>([]);
  const [editing, setEditing] = useState<TariffDto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => setItems(await apiRequest<TariffDto[]>('/tariffs')), []);
  const loadClasses =
  useCallback(async () => {
    const response =
      await apiRequest<ClassListDto>(
        '/classes?status=ACTIVE&page=1&pageSize=100',
      );

    setClasses(response.items);
  }, []);

  useEffect(() => {
    void Promise.all([
      load(),
      loadClasses(),
    ]);
  }, [load, loadClasses]);

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

  async function remove(item: TariffDto) {
  const confirmed = confirm(
    `¿Eliminar definitivamente la tarifa "${item.name}"?\n\nEsta acción no se puede deshacer.`,
  );

  if (!confirmed) {
    return;
  }

  setMessage('');

  try {
    await apiRequest(
      `/tariffs/${item.id}/permanent`,
      {
        method: 'DELETE',
      },
    );

    if (editing?.id === item.id) {
      setEditing(null);
      setForm(emptyForm);
    }

    await load();
  } catch (error) {
    setMessage(
      error instanceof ApiClientError
        ? error.message
        : 'No se pudo eliminar la tarifa',
    );
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
      <PermissionGate permission="tariffs:manage">
        <section className="card">
          <h2>{editing ? 'Editar tarifa' : 'Nueva tarifa'}</h2>
          <form className="catalog-form tariff-form" onSubmit={submit}>
            <label>
                Clase
              <select
                required
                value={form.classId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    classId: event.target.value,
                  })
                }
              >
                <option value="">
                  Seleccionar clase
                </option>

                {classes.map((academicClass) => (
                  <option
                    key={academicClass.id}
                    value={academicClass.id}
                  >
                    {academicClass.name}
                  </option>
                ))}
              </select>
            </label>
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
      </PermissionGate>
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Clase</th>
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
                  <td data-label="Clase">
                    {classes.find(
                      (academicClass) =>
                        academicClass.id === item.classId,
                    )?.name ?? 'Clase no encontrada'}
                  </td>
                  <td data-label="Nombre">{item.name}</td>
                  <td data-label="Monto">{money(item.amount)}</td>
                  <td data-label="Vigencia">
                    {formatDate(item.validFrom)} – {formatDate(item.validTo)}
                  </td>
                  <td data-label="Estado">
                    <span className={`status ${item.status.toLowerCase()}`}>
                      {item.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="actions" data-label="Acciones">
                    <PermissionGate permission="tariffs:manage">
                      <button
                        className="secondary"
                        onClick={() => {
                          setEditing(item);
                          setForm({
                            classId: item.classId,
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
                      {item.status === 'INACTIVE' && (
                      <button
                        className="secondary"
                        onClick={() => void remove(item)}
                      >
                        Eliminar
                      </button>
                    )}
                    </PermissionGate>
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
