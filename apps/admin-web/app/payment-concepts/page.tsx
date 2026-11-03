'use client';
import type { PaymentConceptDto } from '@academy/contracts';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '../../lib/api-client';

const emptyForm = { name: '', requiresDetail: false };

/**
 * Conceptos de ingreso de los otros cobros (indumentaria, inscripciones, talleres…). Se agregan y
 * se renombran; un concepto con cobros se desactiva para que no aparezca al cobrar.
 */
export default function Page() {
  const [items, setItems] = useState<readonly PaymentConceptDto[] | null>(null);
  const [editing, setEditing] = useState<PaymentConceptDto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(
    async () => setItems(await apiRequest<PaymentConceptDto[]>('/payment-concepts?status=ALL')),
    [],
  );
  useEffect(() => {
    load().catch(() => setMessage('No se pudieron cargar los conceptos.'));
  }, [load]);

  async function save(path: string, method: 'POST' | 'PATCH', body: object) {
    setSaving(true);
    setMessage('');
    try {
      await apiRequest(path, { method, body: JSON.stringify(body) });
      await load();
      return true;
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo guardar.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await save(
      editing ? `/payment-concepts/${editing.id}` : '/payment-concepts',
      editing ? 'PATCH' : 'POST',
      form,
    );
    if (ok) {
      setEditing(null);
      setForm(emptyForm);
    }
  }

  const toggle = (item: PaymentConceptDto) =>
    void save(`/payment-concepts/${item.id}`, 'PATCH', {
      name: item.name,
      requiresDetail: item.requiresDetail,
      status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Conceptos de cobro</h1>
          <p>
            Lo que se cobra además de las cuotas y las clases sueltas. Aparecen en &quot;Clase
            suelta u otro&quot; y separan la recaudación por concepto.
          </p>
        </div>
      </div>
      <section className="card">
        <h2>{editing ? `Editar "${editing.name}"` : 'Nuevo concepto'}</h2>
        <form
          className="catalog-form payment-concept-form"
          onSubmit={(event) => void submit(event)}
        >
          <label>
            Nombre
            <input
              required
              maxLength={80}
              value={form.name}
              disabled={saving}
              placeholder="Ej.: Seminario intensivo"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label className="payment-concept-detail">
            <input
              type="checkbox"
              checked={form.requiresDetail}
              disabled={saving}
              onChange={(event) => setForm({ ...form, requiresDetail: event.target.checked })}
            />
            Pide contar qué se cobró
          </label>
          <div className="form-actions">
            {editing && (
              <button
                type="button"
                className="secondary"
                disabled={saving}
                onClick={() => {
                  setEditing(null);
                  setForm(emptyForm);
                }}
              >
                Cancelar
              </button>
            )}
            <button disabled={saving}>{editing ? 'Guardar cambios' : 'Agregar'}</button>
          </div>
        </form>
        {message && (
          <p className="error" role="alert">
            {message}
          </p>
        )}
      </section>
      <section className="card">
        {items === null ? (
          <p className="modal-copy">Cargando conceptos…</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Detalle</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Concepto">
                      <strong>{item.name}</strong>
                    </td>
                    <td data-label="Detalle">{item.requiresDetail ? 'Obligatorio' : 'Opcional'}</td>
                    <td data-label="Estado">
                      <span className={`status ${item.status.toLowerCase()}`}>
                        {item.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="actions" data-label="Acciones">
                      <button
                        className="secondary"
                        disabled={saving}
                        onClick={() => {
                          setEditing(item);
                          setForm({ name: item.name, requiresDetail: item.requiresDetail });
                        }}
                      >
                        Editar
                      </button>
                      <button className="secondary" disabled={saving} onClick={() => toggle(item)}>
                        {item.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
