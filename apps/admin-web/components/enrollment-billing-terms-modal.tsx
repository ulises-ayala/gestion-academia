'use client';

import type { EnrollmentDto, TariffDto, UpdateEnrollmentBillingTermsDto } from '@academy/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { businessToday } from '../lib/dates';
import { modalityOptions } from '../lib/enrollment-billing';
import { Button } from './ui/button';
import { Input, Select } from './ui/form-controls';

/** Modalidad (tarifa) y día de pago de una inscripción; valen para las cuotas futuras. */
export function EnrollmentBillingTermsModal({
  enrollment,
  onClose,
  onSaved,
}: Readonly<{
  enrollment: EnrollmentDto;
  onClose(): void;
  onSaved(): void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tariffs, setTariffs] = useState<TariffDto[] | null>(null);
  const [tariffId, setTariffId] = useState(enrollment.tariff?.id ?? '');
  const [day, setDay] = useState(String(enrollment.paymentDueDay));
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
    let active = true;
    apiRequest<TariffDto[]>('/tariffs?status=ACTIVE')
      .then((items) => active && setTariffs(items))
      .catch(() => {
        if (!active) return;
        setTariffs([]);
        setError('No se pudieron cargar las tarifas de la clase.');
      });
    return () => {
      active = false;
    };
  }, []);
  const options = modalityOptions(tariffs ?? [], enrollment.classId, businessToday());
  // La modalidad actual puede haber dejado de estar vigente: se muestra igual.
  const current = enrollment.tariff;
  const parsedDay = Number(day);
  const validDay = Number.isInteger(parsedDay) && parsedDay >= 1 && parsedDay <= 31;
  const changed =
    tariffId !== (current?.id ?? '') || (validDay && parsedDay !== enrollment.paymentDueDay);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !changed || !validDay) return;
    setSaving(true);
    setError('');
    const body: UpdateEnrollmentBillingTermsDto = {
      tariffId: tariffId || null,
      paymentDueDay: parsedDay,
    };
    try {
      await apiRequest(`/enrollments/${enrollment.id}/billing-terms`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo guardar el cambio.');
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="modal card enrollment-end-dialog"
      aria-labelledby="enrollment-terms-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)} className="follow-up-stack">
        <h2 id="enrollment-terms-title">Modalidad y día de pago</h2>
        <p>
          Actividad: <strong>{enrollment.academicClass.name}</strong>
        </p>
        <Select
          id="enrollment-terms-tariff"
          label="Modalidad (tarifa)"
          value={tariffId}
          disabled={saving || tariffs === null}
          onChange={(event) => setTariffId(event.target.value)}
        >
          <option value="">Tarifa de la clase (si tiene una sola)</option>
          {current && !options.some(({ id }) => id === current.id) && (
            <option value={current.id}>{current.name} (ya no vigente)</option>
          )}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
        <Input
          id="enrollment-terms-day"
          label="Día de pago"
          type="number"
          min={1}
          max={31}
          required
          value={day}
          disabled={saving}
          error={day && !validDay ? 'Ingresá un día del 1 al 31.' : undefined}
          onChange={(event) => setDay(event.target.value)}
        />
        <p className="modal-note neutral">
          Vale para las cuotas que se generen desde ahora. Las ya generadas no cambian: su
          vencimiento se corrige en el estado de cuenta. En meses más cortos vence el último día.
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
          <Button type="submit" disabled={saving || !changed || !validDay} loading={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
