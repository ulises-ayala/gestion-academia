'use client';

import type { EndEnrollmentDto, EnrollmentEndReasonDto } from '@academy/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { businessToday } from '../lib/dates';
import { enrollmentEndLabels } from '../lib/enrollment-end';
import { Button } from './ui/button';
import { Input, Select, Textarea } from './ui/form-controls';

export type EndEnrollmentTarget = Readonly<{
  enrollmentId: string;
  studentName: string;
  className: string;
  startDate: string;
}>;

export function EndEnrollmentModal({
  target,
  onClose,
  onEnded,
}: Readonly<{
  target: EndEnrollmentTarget;
  onClose(): void;
  onEnded(): void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [endDate, setEndDate] = useState(businessToday());
  const [reason, setReason] = useState<EnrollmentEndReasonDto | ''>('');
  const [note, setNote] = useState('');
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
    if (saving || !reason) return;
    if (reason === 'OTHER' && !note.trim()) {
      setError('Contanos brevemente el motivo.');
      return;
    }
    setSaving(true);
    setError('');
    const body: EndEnrollmentDto = { endDate, endReason: reason, endNote: note.trim() || null };
    try {
      await apiRequest(`/enrollments/${target.enrollmentId}/end`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onEnded();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'No se pudo finalizar la inscripción.',
      );
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="modal card enrollment-end-dialog"
      aria-labelledby="enrollment-end-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)} className="follow-up-stack">
        <h2 id="enrollment-end-title">Finalizar inscripción</h2>
        <p>
          Alumno: <strong>{target.studentName}</strong>
          <br />
          Actividad: <strong>{target.className}</strong>
        </p>
        <Input
          id="enrollment-end-date"
          label="Fecha de finalización"
          type="date"
          required
          min={target.startDate}
          value={endDate}
          disabled={saving}
          onChange={(event) => setEndDate(event.target.value)}
        />
        <Select
          id="enrollment-end-reason"
          label="Motivo *"
          required
          autoFocus
          value={reason}
          disabled={saving}
          onChange={(event) => setReason(event.target.value as EnrollmentEndReasonDto | '')}
        >
          <option value="">Seleccioná un motivo</option>
          {Object.entries(enrollmentEndLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </Select>
        <Textarea
          id="end-note"
          label={<>Observación{reason === 'OTHER' ? ' *' : ' (opcional)'}</>}
          required={reason === 'OTHER'}
          maxLength={500}
          rows={3}
          value={note}
          disabled={saving}
          onChange={(event) => setNote(event.target.value)}
          helpText={reason === 'OTHER' ? 'Contanos brevemente el motivo.' : undefined}
        />
        <p className="modal-note neutral">
          El historial de la inscripción se conservará. El alumno seguirá conservando sus demás
          actividades.
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
          <Button type="submit" disabled={saving || !reason} loading={saving}>
            {saving ? 'Finalizando…' : 'Finalizar inscripción'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
