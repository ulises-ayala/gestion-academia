'use client';

import type { MonthlyChargeDto, VoidMonthlyChargeDto } from '@academy/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { chargeLabel, money } from '../lib/collect-payment';
import { Button } from './ui/button';
import { Textarea } from './ui/form-controls';

/**
 * Anula una cuota generada por error (sin pagos imputados). Queda guardada como anulada y deja de
 * contar como deuda; no toca pagos ni caja.
 */
export function ChargeVoidModal({
  charge,
  onClose,
  onSaved,
}: Readonly<{ charge: MonthlyChargeDto; onClose(): void; onSaved(): void }>) {
  const dialog = useRef<HTMLDialogElement>(null);
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !reason.trim()) return;
    setSaving(true);
    setError('');
    const body: VoidMonthlyChargeDto = { reason: reason.trim() };
    try {
      await apiRequest(`/monthly-charges/${charge.id}/void`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo anular la cuota.');
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal card enrollment-end-dialog"
      aria-labelledby="charge-void-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)} className="follow-up-stack">
        <h2 id="charge-void-title">Anular cuota</h2>
        <p>
          {charge.academicClass.name} · <strong>{chargeLabel(charge)}</strong> ·{' '}
          {money(charge.outstandingAmount)}
        </p>
        <Textarea
          id="charge-void-reason"
          label="Motivo"
          required
          maxLength={500}
          value={reason}
          disabled={saving}
          placeholder="Se generó por error: correspondía a noviembre"
          onChange={(event) => setReason(event.target.value)}
        />
        <p className="modal-note neutral">
          La cuota queda anulada (no se borra) y deja de contar como deuda, con su recargo. Solo se
          puede si no tiene pagos: si los tiene, pasalos antes a la cuota que corresponde desde
          Corregir → Cuotas.
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
          <Button
            type="submit"
            variant="destructive"
            disabled={saving || !reason.trim()}
            loading={saving}
          >
            {saving ? 'Anulando…' : 'Anular cuota'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
