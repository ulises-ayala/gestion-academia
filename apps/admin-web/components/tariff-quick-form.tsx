'use client';

import type { TariffDto } from '@academy/contracts';
import React, { useEffect, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import {
  formatTariffRange,
  overlappingTariff,
  periodLabel,
  tariffDraft,
  type TariffDraft,
} from '../lib/charge-generation';

const money = (value: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));

/** Alta rápida de una tarifa para la clase, desde la ventana de Generar cuota. */
export function TariffQuickForm({
  classId,
  className,
  period,
  onBack,
  onCreated,
}: Readonly<{
  classId: string;
  className: string;
  period: string;
  onBack(): void;
  onCreated(tariff: TariffDto): void;
}>) {
  const [tariffs, setTariffs] = useState<TariffDto[] | null>(null);
  const [draft, setDraft] = useState<TariffDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<TariffDto[]>('/tariffs')
      .then((items) => {
        if (!active) return;
        const own = items.filter((item) => item.classId === classId);
        setTariffs(own);
        setDraft(tariffDraft(own, period, className));
      })
      .catch((caught) => {
        if (!active) return;
        setTariffs([]);
        setDraft(tariffDraft([], period, className));
        setError(
          caught instanceof ApiClientError ? caught.message : 'No se pudieron cargar las tarifas.',
        );
      });
    return () => {
      active = false;
    };
  }, [classId, className, period]);

  const overlap = draft && tariffs ? overlappingTariff(tariffs, draft) : null;
  const coversPeriod =
    draft !== null &&
    draft.validFrom.slice(0, 7) <= period &&
    (!draft.validTo || draft.validTo.slice(0, 7) >= period);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || overlap || saving) return;
    setSaving(true);
    setError('');
    try {
      const created = await apiRequest<TariffDto>('/tariffs', {
        method: 'POST',
        body: JSON.stringify({
          classId,
          name: draft.name.trim(),
          amount: draft.amount.trim().replace(',', '.'),
          validFrom: draft.validFrom,
          validTo: draft.validTo || null,
        }),
      });
      onCreated(created);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo crear la tarifa.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="generate-charge">
      <div>
        <h2 id="generate-charge-title">Nueva tarifa</h2>
        <p className="modal-copy">
          Clase: <strong>{className}</strong> · para cubrir {periodLabel(period).toLowerCase()}
        </p>
      </div>
      {tariffs && tariffs.length > 0 && (
        <div className="generate-charge-preview">
          <p className="modal-copy">Tarifas que ya tiene la clase</p>
          {tariffs.map((tariff) => (
            <p key={tariff.id}>
              <span>
                {tariff.name}
                <small>
                  {formatTariffRange(tariff)} ·{' '}
                  {tariff.status === 'ACTIVE' ? 'Activa' : 'Desactivada'}
                </small>
              </span>
              <span>{money(tariff.amount)}</span>
            </p>
          ))}
        </div>
      )}
      {!draft ? (
        <p className="modal-copy" role="status">
          Cargando tarifas…
        </p>
      ) : (
        <div className="generate-charge-fields">
          <label className="wide">
            Nombre
            <input
              required
              maxLength={120}
              value={draft.name}
              disabled={saving}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label className="wide">
            Monto mensual
            <input
              required
              inputMode="decimal"
              placeholder="40000"
              value={draft.amount}
              disabled={saving}
              onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
            />
          </label>
          <label>
            Vigente desde
            <input
              type="date"
              required
              value={draft.validFrom}
              disabled={saving}
              onChange={(event) => setDraft({ ...draft, validFrom: event.target.value })}
            />
          </label>
          <label>
            Vigente hasta (opcional)
            <input
              type="date"
              value={draft.validTo}
              min={draft.validFrom}
              disabled={saving}
              onChange={(event) => setDraft({ ...draft, validTo: event.target.value })}
            />
          </label>
        </div>
      )}
      {overlap ? (
        <p className="generate-charge-note is-blocked" role="status">
          Se superpone con «{overlap.name}», que rige {formatTariffRange(overlap)}. Ajustá las
          fechas para que no se pisen.
        </p>
      ) : draft && !coversPeriod ? (
        <p className="generate-charge-note" role="status">
          Con estas fechas la tarifa no cubre {periodLabel(period).toLowerCase()}.
        </p>
      ) : null}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="secondary" type="button" disabled={saving} onClick={onBack}>
          Volver a la cuota
        </button>
        <button
          type="submit"
          disabled={
            !draft || !draft.name.trim() || !draft.amount.trim() || Boolean(overlap) || saving
          }
        >
          {saving ? 'Creando…' : 'Crear tarifa'}
        </button>
      </div>
    </form>
  );
}
