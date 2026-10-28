'use client';

import type {
  ChangeEnrollmentClassDto,
  ClassListDto,
  EnrollmentEndReasonDto,
} from '@academy/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { businessToday } from '../lib/dates';
import { enrollmentEndLabels } from '../lib/enrollment-end';
import { dayLabels } from '../lib/offering';
import { Button } from './ui/button';
import { Input, Select, Textarea } from './ui/form-controls';

export type ChangeEnrollmentClassTarget = Readonly<{
  enrollmentId: string;
  classId: string;
  className: string;
  startDate: string;
}>;

const nextDay = (date: string) =>
  new Date(new Date(`${date}T00:00:00.000Z`).getTime() + 86_400_000).toISOString().slice(0, 10);

export function ChangeEnrollmentClassModal({
  target,
  onClose,
  onChanged,
}: Readonly<{
  target: ChangeEnrollmentClassTarget;
  onClose(): void;
  onChanged(newClassName: string): void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const minDate = nextDay(target.startDate);
  const today = businessToday();
  const [classes, setClasses] = useState<ClassListDto['items']>([]);
  const [classId, setClassId] = useState('');
  const [changeDate, setChangeDate] = useState(today < minDate ? minDate : today);
  const [reason, setReason] = useState<EnrollmentEndReasonDto>('SCHEDULE_CHANGE');
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
  useEffect(() => {
    apiRequest<ClassListDto>('/classes?status=ACTIVE&page=1&pageSize=100')
      .then((list) => setClasses(list.items.filter((item) => item.id !== target.classId)))
      .catch(() => setError('No se pudieron cargar las clases.'));
  }, [target.classId]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !classId) return;
    if (reason === 'OTHER' && !note.trim()) {
      setError('Contanos brevemente el motivo.');
      return;
    }
    setSaving(true);
    setError('');
    const body: ChangeEnrollmentClassDto = {
      classId,
      changeDate,
      endReason: reason,
      endNote: note.trim() || null,
    };
    try {
      await apiRequest(`/enrollments/${target.enrollmentId}/change-class`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onChanged(classes.find((item) => item.id === classId)?.name ?? 'la nueva clase');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo cambiar de clase.');
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="modal card enrollment-end-dialog"
      aria-labelledby="enrollment-change-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)} className="follow-up-stack">
        <h2 id="enrollment-change-title">Cambiar de clase</h2>
        <p>
          Clase actual: <strong>{target.className}</strong>
        </p>
        <Select
          id="enrollment-change-class"
          label="Nueva clase *"
          required
          autoFocus
          value={classId}
          disabled={saving}
          onChange={(event) => setClassId(event.target.value)}
        >
          <option value="">Seleccioná una clase</option>
          {classes.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
              {item.level ? ` · ${item.level}` : ''}
              {item.schedules.length > 0
                ? ` · ${item.schedules
                    .map((s) => `${dayLabels[s.dayOfWeek]} ${s.startTime}`)
                    .join(', ')}`
                : ''}
            </option>
          ))}
        </Select>
        <Input
          id="enrollment-change-date"
          label="Desde"
          type="date"
          required
          min={minDate}
          value={changeDate}
          disabled={saving}
          onChange={(event) => setChangeDate(event.target.value)}
        />
        <Select
          id="enrollment-change-reason"
          label="Motivo *"
          required
          value={reason}
          disabled={saving}
          onChange={(event) => setReason(event.target.value as EnrollmentEndReasonDto)}
        >
          {Object.entries(enrollmentEndLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </Select>
        <Textarea
          id="enrollment-change-note"
          label={<>Observación{reason === 'OTHER' ? ' *' : ' (opcional)'}</>}
          required={reason === 'OTHER'}
          maxLength={500}
          rows={2}
          value={note}
          disabled={saving}
          onChange={(event) => setNote(event.target.value)}
        />
        <p className="modal-note neutral">
          La inscripción actual se finaliza el día anterior y queda en el historial. Las cuotas ya
          generadas no se mueven, y las becas o descuentos no pasan a la clase nueva.
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
          <Button type="submit" disabled={saving || !classId} loading={saving}>
            {saving ? 'Cambiando…' : 'Cambiar de clase'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
