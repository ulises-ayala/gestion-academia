'use client';

import type { ChangeMonthlyChargeDueDateDto, MonthlyChargeDto } from '@academy/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { lastDayOfPeriod } from '../lib/charge-generation';
import { chargeLabel } from '../lib/collect-payment';
import { Button } from './ui/button';
import { Input, Textarea } from './ui/form-controls';

/** Cambia el vencimiento de una cuota con saldo, dentro de su mes, con motivo. */
export function ChargeDueDateModal({
  charge,
  onClose,
  onSaved,
}: Readonly<{
  charge: MonthlyChargeDto;
  onClose(): void;
  onSaved(): void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [dueDate, setDueDate] = useState(charge.dueDate);
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
  const ready = Boolean(dueDate) && dueDate !== charge.dueDate && reason.trim().length > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !ready) return;
    setSaving(true);
    setError('');
    const body: ChangeMonthlyChargeDueDateDto = { dueDate, reason: reason.trim() };
    try {
      await apiRequest(`/monthly-charges/${charge.id}/due-date`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'No se pudo cambiar el vencimiento.',
      );
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="modal card enrollment-end-dialog"
      aria-labelledby="charge-due-date-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)} className="follow-up-stack">
        <h2 id="charge-due-date-title">Cambiar vencimiento</h2>
        <p>
          {charge.academicClass.name} · <strong>{chargeLabel(charge)}</strong>
        </p>
        <Input
          id="charge-due-date"
          label="Nuevo vencimiento"
          type="date"
          required
          autoFocus
          value={dueDate}
          min={`${charge.period}-01`}
          max={lastDayOfPeriod(charge.period)}
          disabled={saving}
          onChange={(event) => setDueDate(event.target.value)}
        />
        <Textarea
          id="charge-due-date-reason"
          label="Motivo"
          required
          maxLength={500}
          value={reason}
          disabled={saving}
          placeholder="Acordó pagar el día 20"
          onChange={(event) => setReason(event.target.value)}
        />
        <p className="modal-note neutral">
          Solo cambia esta cuota y dentro de su mes. Para las próximas cuotas, cambiá el día de pago
          en la ficha del alumno. Si la cuota ya tiene el recargo aplicado, primero hay que
          quitarlo.
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
            {saving ? 'Guardando…' : 'Guardar vencimiento'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
