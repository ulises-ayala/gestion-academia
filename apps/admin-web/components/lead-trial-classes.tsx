'use client';

import type { ClassListDto, LeadTrialClassDto } from '@academy/contracts';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { businessToday, formatDate } from '../lib/dates';
import { trialClassOptions } from '../lib/leads';

const errorText = (error: unknown, fallback: string) =>
  error instanceof ApiClientError ? error.message : fallback;

/**
 * Clases de prueba gratis del potencial alumno: una sola vez por clase, sin deuda ni inscripción.
 * Registrar una pasa al potencial alumno a "Clase de prueba" (onChanged recarga la ficha).
 */
export function LeadTrialClasses({
  leadId,
  onChanged,
}: Readonly<{ leadId: string; onChanged(): void }>) {
  const today = businessToday();
  const [trials, setTrials] = useState<readonly LeadTrialClassDto[] | null>(null);
  const [classes, setClasses] = useState<ClassListDto['items']>([]);
  const [form, setForm] = useState({ classId: '', trialDate: today, notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setTrials(await apiRequest<LeadTrialClassDto[]>(`/leads/${leadId}/trial-classes`));
    } catch (caught) {
      setError(errorText(caught, 'No se pudieron cargar las clases de prueba.'));
    }
  }, [leadId]);

  useEffect(() => {
    void load();
    apiRequest<ClassListDto>('/classes?status=ACTIVE&pageSize=100')
      .then((result) => setClasses(result.items))
      .catch(() => setClasses([]));
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.classId || saving) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest<LeadTrialClassDto>(`/leads/${leadId}/trial-classes`, {
        method: 'POST',
        body: JSON.stringify({
          classId: form.classId,
          trialDate: form.trialDate,
          notes: form.notes.trim() || null,
        }),
      });
      setForm({ classId: '', trialDate: today, notes: '' });
      await load();
      onChanged();
    } catch (caught) {
      setError(errorText(caught, 'No se pudo registrar la clase de prueba.'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(trial: LeadTrialClassDto) {
    const reason = window.prompt(
      `¿Por qué quitás la clase de prueba de ${trial.academicClass.name}? Queda registrado.`,
    );
    if (!reason?.trim()) return;
    setError('');
    try {
      await apiRequest(`/leads/${leadId}/trial-classes/${trial.id}/remove`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      await load();
    } catch (caught) {
      setError(errorText(caught, 'No se pudo quitar la clase de prueba.'));
    }
  }

  const options = trialClassOptions(classes, trials ?? []);

  return (
    <section className="card">
      <h2>Clases de prueba</h2>
      <p className="subtitle">
        La primera clase de cada disciplina es gratis y se prueba una sola vez por clase. No genera
        deuda ni inscripción.
      </p>
      {trials === null ? (
        <p>{error || 'Cargando…'}</p>
      ) : trials.length === 0 ? (
        <p className="empty-state">Todavía no tomó ninguna clase de prueba.</p>
      ) : (
        <ul className="lead-trials">
          {trials.map((trial) => (
            <li key={trial.id}>
              <span>
                <strong>{trial.academicClass.name}</strong>
                <small>
                  {formatDate(trial.trialDate)} · cargó {trial.createdBy.username}
                  {trial.notes ? ` · ${trial.notes}` : ''}
                </small>
              </span>
              <button type="button" className="link-button" onClick={() => void remove(trial)}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="lead-trial-form" onSubmit={(event) => void submit(event)}>
        <label>
          Clase
          <select
            value={form.classId}
            disabled={saving}
            onChange={(event) => setForm({ ...form, classId: event.target.value })}
          >
            <option value="">Elegí la clase</option>
            {options.map(({ item, triedOn }) => (
              <option key={item.id} value={item.id} disabled={triedOn !== null}>
                {item.name}
                {triedOn ? ` (ya la probó el ${formatDate(triedOn)})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha
          <input
            type="date"
            max={today}
            value={form.trialDate}
            disabled={saving}
            onChange={(event) => setForm({ ...form, trialDate: event.target.value })}
          />
        </label>
        <label className="wide">
          Nota (opcional)
          <input
            maxLength={500}
            value={form.notes}
            disabled={saving}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </label>
        {error && trials !== null && (
          <p className="error wide" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={saving || !form.classId}>
          {saving ? 'Registrando…' : 'Registrar clase de prueba'}
        </button>
      </form>
    </section>
  );
}
