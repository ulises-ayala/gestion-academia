'use client';

import type { UpdateEnrollmentStartDateDto } from '@academy/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { Button } from './ui/button';
import { Input } from './ui/form-controls';

export type EnrollmentStartDateTarget = Readonly<{
  enrollmentId: string;
  className: string;
  startDate: string;
}>;

export function EnrollmentStartDateModal({
  target,
  onClose,
  onSaved,
}: Readonly<{
  target: EnrollmentStartDateTarget;
  onClose(): void;
  onSaved(): void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [startDate, setStartDate] = useState(target.startDate);
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
    if (saving || startDate === target.startDate) return;
    setSaving(true);
    setError('');
    const body: UpdateEnrollmentStartDateDto = { startDate };
    try {
      await apiRequest(`/enrollments/${target.enrollmentId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : 'No se pudo cambiar la fecha de inicio.',
      );
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="modal card enrollment-end-dialog"
      aria-labelledby="enrollment-start-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)} className="follow-up-stack">
        <h2 id="enrollment-start-title">Cambiar fecha de inicio</h2>
        <p>
          Actividad: <strong>{target.className}</strong>
        </p>
        <Input
          id="enrollment-start-date"
          label="Fecha de inicio"
          type="date"
          required
          autoFocus
          value={startDate}
          disabled={saving}
          onChange={(event) => setStartDate(event.target.value)}
        />
        <p className="modal-note neutral">
          Corrige desde cuándo está inscripto. Las cuotas ya generadas no se modifican.
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
            disabled={saving || !startDate || startDate === target.startDate}
            loading={saving}
          >
            {saving ? 'Guardando…' : 'Guardar fecha'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
