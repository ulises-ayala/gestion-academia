'use client';

import type { EnrollmentDto, MonthlyChargeDto, MoveMonthlyChargeDto } from '@academy/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { chargeLabel } from '../lib/collect-payment';
import { Button } from './ui/button';
import { Select, Textarea } from './ui/form-controls';

/**
 * Pasa una cuota (pagada o no) a otra clase activa del alumno: para un cambio de clase sin volver a
 * cobrar. Cambia a qué clase y profesor se atribuye; el pago queda igual.
 */
export function MoveChargeModal({
  charge,
  targets,
  onClose,
  onSaved,
}: Readonly<{
  charge: MonthlyChargeDto;
  /** Inscripciones activas del alumno a otras clases. */
  targets: readonly EnrollmentDto[];
  onClose(): void;
  onSaved(className: string): void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [enrollmentId, setEnrollmentId] = useState(targets.length === 1 ? targets[0]!.id : '');
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
  const ready = Boolean(enrollmentId) && reason.trim().length > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !ready) return;
    setSaving(true);
    setError('');
    const body: MoveMonthlyChargeDto = { enrollmentId, reason: reason.trim() };
    try {
      await apiRequest(`/monthly-charges/${charge.id}/enrollment`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onSaved(targets.find((item) => item.id === enrollmentId)?.academicClass.name ?? '');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo pasar la cuota.');
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal card enrollment-end-dialog"
      aria-labelledby="move-charge-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)} className="follow-up-stack">
        <h2 id="move-charge-title">Pasar cuota a otra clase</h2>
        <p>
          <strong>{chargeLabel(charge)}</strong> · hoy en {charge.academicClass.name}
        </p>
        <Select
          id="move-charge-enrollment"
          label="Nueva clase"
          required
          value={enrollmentId}
          disabled={saving}
          onChange={(event) => setEnrollmentId(event.target.value)}
        >
          <option value="">Elegí la clase</option>
          {targets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.academicClass.name}
            </option>
          ))}
        </Select>
        <Textarea
          id="move-charge-reason"
          label="Motivo"
          required
          maxLength={500}
          value={reason}
          disabled={saving}
          placeholder="Se cambió de clase y ya había pagado noviembre"
          onChange={(event) => setReason(event.target.value)}
        />
        <p className="modal-note neutral">
          No se cobra de nuevo: la cuota, lo pagado y sus becas quedan igual. Solo cambia a qué
          clase y profesor se atribuye en ingresos y liquidaciones.
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
            {saving ? 'Pasando…' : 'Pasar cuota'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
