'use client';

import type {
  MonthlyChargeDto,
  MonthlyChargeTariffUpdateDto,
  UpdateMonthlyChargeTariffDto,
} from '@academy/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { chargeLabel } from '../lib/collect-payment';
import { Button } from './ui/button';
import { Textarea } from './ui/form-controls';
import { money } from '../lib/money';

/**
 * Actualiza una cuota sin pagos al importe de la modalidad que hoy tiene la inscripción (por
 * ejemplo, si la modalidad se cambió después de generar la cuota). Muestra el cambio antes.
 */
export function ChargeTariffUpdateModal({
  charge,
  onClose,
  onSaved,
}: Readonly<{
  charge: MonthlyChargeDto;
  onClose(): void;
  onSaved(result: MonthlyChargeTariffUpdateDto): void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<MonthlyChargeTariffUpdateDto | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      opener?.focus();
    };
  }, []);
  useEffect(() => {
    apiRequest<MonthlyChargeTariffUpdateDto>(`/monthly-charges/${charge.id}/tariff-update`)
      .then(setPreview)
      .catch((caught) =>
        setError(
          caught instanceof ApiClientError ? caught.message : 'No se pudo calcular el importe.',
        ),
      );
  }, [charge.id]);
  const ready = Boolean(preview) && reason.trim().length > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !ready) return;
    setSaving(true);
    setError('');
    const body: UpdateMonthlyChargeTariffDto = { reason: reason.trim() };
    try {
      onSaved(
        await apiRequest<MonthlyChargeTariffUpdateDto>(
          `/monthly-charges/${charge.id}/tariff-update`,
          { method: 'POST', body: JSON.stringify(body) },
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'No se pudo actualizar el importe.',
      );
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="modal card enrollment-end-dialog"
      aria-labelledby="charge-tariff-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)} className="follow-up-stack">
        <h2 id="charge-tariff-title">Actualizar importe</h2>
        <p>
          {charge.academicClass.name} · <strong>{chargeLabel(charge)}</strong>
        </p>
        {preview && (
          <p>
            Hoy: <strong>{money(preview.current.amount)}</strong>
            {preview.current.tariffName ? ` (${preview.current.tariffName})` : ''}. Con la modalidad
            de la inscripción: <strong>{money(preview.next.amount)}</strong> (
            {preview.next.tariffName}).
          </p>
        )}
        <Textarea
          id="charge-tariff-reason"
          label="Motivo"
          required
          maxLength={500}
          value={reason}
          disabled={saving || !preview}
          placeholder="La modalidad se cambió después de generar la cuota"
          onChange={(event) => setReason(event.target.value)}
        />
        <p className="modal-note neutral">
          Solo para cuotas sin pagos, becas ni recargo. Usa la modalidad que tiene hoy la
          inscripción; para cambiarla, usá “Cambiar” en la ficha del alumno.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !ready} loading={saving}>
            {saving ? 'Guardando…' : 'Actualizar importe'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
