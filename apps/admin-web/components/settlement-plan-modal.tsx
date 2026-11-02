'use client';

import type {
  ClassSettlementOverviewDto,
  ClassSettlementPlanDto,
  SaveClassSettlementPlanDto,
  TeacherListDto,
} from '@academy/contracts';
import { Plus, X } from 'lucide-react';
import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { periodLabel } from '../lib/charge-generation';
import {
  academyShare,
  equalShares,
  percentLabel,
  sharesProblem,
  type ShareRow,
} from '../lib/settlements';

/**
 * Reparto de una clase desde un mes: qué porcentaje de lo cobrado se lleva cada profesor. Lo que
 * no se reparte queda para la academia (Dirección).
 */
export function SettlementPlanModal({
  item,
  period,
  onClose,
  onSaved,
}: Readonly<{
  item: ClassSettlementOverviewDto;
  /** Mes que se está mirando: es el "desde" sugerido. */
  period: string;
  onClose(): void;
  onSaved(plan: ClassSettlementPlanDto): void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { academicClass, plan } = item;
  const [validFrom, setValidFrom] = useState(period);
  const [rows, setRows] = useState<ShareRow[]>(() =>
    plan
      ? plan.shares.map((share) => ({
          teacherId: share.teacher.id,
          percentage: String(Number(share.percentage)).replace('.', ','),
        }))
      : academicClass.teachers.map((teacher) => ({ teacherId: teacher.id, percentage: '' })),
  );
  const [teachers, setTeachers] = useState(academicClass.teachers);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
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
    apiRequest<TeacherListDto>('/teachers?status=ACTIVE&pageSize=100')
      .then((result) =>
        setTeachers((current) => [
          ...current,
          ...result.items.filter((teacher) => !current.some(({ id }) => id === teacher.id)),
        ]),
      )
      .catch(() => undefined);
  }, []);

  const problem = !/^\d{4}-\d{2}$/.test(validFrom)
    ? 'Elegí desde qué mes rige.'
    : sharesProblem(rows);
  const rest = academyShare(rows);
  const update = (index: number, change: Partial<ShareRow>) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...change } : row)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (problem || saving) return;
    setSaving(true);
    setError('');
    const body: SaveClassSettlementPlanDto = {
      validFrom,
      shares: rows.map((row) => ({
        teacherId: row.teacherId,
        percentage: row.percentage.trim().replace(',', '.'),
      })),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    };
    try {
      onSaved(
        await apiRequest<ClassSettlementPlanDto>(`/classes/${academicClass.id}/settlement-plans`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'No se pudo guardar el reparto.',
      );
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal card settlement-plan-dialog"
      aria-labelledby="settlement-plan-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form className="settlement-plan-form" onSubmit={(event) => void submit(event)} noValidate>
        <header>
          <h2 id="settlement-plan-title">Reparto de {academicClass.name}</h2>
          <p className="modal-copy">
            Qué porcentaje de lo cobrado (cuotas y clases sueltas) se lleva cada profesor. Lo que no
            se reparte queda para la academia.
          </p>
        </header>

        <label className="settlement-plan-from">
          Rige desde
          <input
            type="month"
            value={validFrom}
            disabled={saving}
            onChange={(event) => setValidFrom(event.target.value)}
          />
          <small className="collect-hint">
            Las cuotas de meses anteriores siguen con el reparto que tenían.
          </small>
        </label>

        <fieldset className="settlement-plan-shares" disabled={saving}>
          <legend>Profesores</legend>
          {rows.length === 0 && (
            <p className="collect-empty">Sin profesores: todo lo cobrado queda para la academia.</p>
          )}
          {rows.map((row, index) => (
            <div className="settlement-share-row" key={index}>
              <select
                aria-label={`Profesor ${index + 1}`}
                value={row.teacherId}
                aria-invalid={tried && !row.teacherId}
                onChange={(event) => update(index, { teacherId: event.target.value })}
              >
                <option value="">Elegí el profesor</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.firstName} {teacher.lastName}
                  </option>
                ))}
              </select>
              <span className="settlement-share-percent">
                <input
                  aria-label={`Porcentaje del profesor ${index + 1}`}
                  inputMode="decimal"
                  placeholder="0"
                  value={row.percentage}
                  onChange={(event) => update(index, { percentage: event.target.value })}
                />
                <span aria-hidden="true">%</span>
              </span>
              <button
                type="button"
                className="secondary icon-button"
                aria-label="Quitar profesor"
                onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
          ))}
          <div className="settlement-plan-tools">
            <button
              type="button"
              className="secondary"
              onClick={() => setRows((current) => [...current, { teacherId: '', percentage: '' }])}
            >
              <Plus aria-hidden="true" size={16} /> Agregar profesor
            </button>
            {rows.length > 1 && (
              <button
                type="button"
                className="link-button"
                onClick={() =>
                  setRows(
                    equalShares(
                      rows.map((row) => row.teacherId),
                      true,
                    ),
                  )
                }
              >
                Partes iguales con Dirección
              </button>
            )}
          </div>
        </fieldset>

        <p className={`settlement-plan-rest ${rest !== null && rest < 0 ? 'is-invalid' : ''}`}>
          Academia (Dirección): <strong>{rest === null ? '—' : percentLabel(rest)}</strong>
          {/^\d{4}-\d{2}$/.test(validFrom) && (
            <span> · desde {periodLabel(validFrom).toLowerCase()}</span>
          )}
        </p>

        <label>
          Motivo (opcional)
          <input
            maxLength={500}
            value={reason}
            disabled={saving}
            placeholder="Ej.: acuerdo con el profesor"
            onChange={(event) => setReason(event.target.value)}
          />
        </label>

        {tried && problem && (
          <p className="field-error" role="status">
            {problem}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar reparto'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
