'use client';

import type {
  ClassDto,
  ClassListDto,
  CreateStudentDto,
  PaymentMethodDto,
  StudentOnboardingResultDto,
  TariffDto,
} from '@academy/contracts';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiClientError, apiRequest } from '../../../lib/api-client';
import { dayLabels } from '../../../lib/offering';
import {
  buildOnboardingPayload,
  onboardingTotal,
  OnboardingSelection,
  selectedClassConflict,
} from '../../../lib/student-onboarding';

type FormState = Record<keyof CreateStudentDto, string>;
const emptyForm: FormState = {
  dni: '',
  firstName: '',
  lastName: '',
  birthDate: '',
  phone: '',
  email: '',
  address: '',
};
const money = (value: string | number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));
const currentPeriod = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);
const periodLabel = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(year!, month! - 1, 1)),
  );
};

export default function NewStudentPage() {
  const [form, setForm] = useState(emptyForm);
  const [classes, setClasses] = useState<readonly ClassDto[]>([]);
  const [tariffs, setTariffs] = useState<readonly TariffDto[]>([]);
  const [selections, setSelections] = useState<readonly OnboardingSelection[]>([]);
  const [period, setPeriod] = useState(currentPeriod);
  const [dueDate, setDueDate] = useState(`${currentPeriod()}-10`);
  const [collect, setCollect] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodDto>('CASH');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<StudentOnboardingResultDto | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest<ClassListDto>('/classes?status=ACTIVE&pageSize=100'),
      apiRequest<readonly TariffDto[]>('/tariffs/active'),
    ])
      .then(([classList, activeTariffs]) => {
        setClasses(classList.items);
        setTariffs(activeTariffs);
      })
      .catch((error) =>
        setMessage(
          error instanceof ApiClientError
            ? error.message
            : 'No se pudieron cargar clases y tarifas',
        ),
      )
      .finally(() => setLoadingOptions(false));
  }, []);

  const conflict = useMemo(() => selectedClassConflict(selections, classes), [selections, classes]);
  const total = onboardingTotal(selections, tariffs);
  const availableClasses = classes.filter(
    ({ id }) => !selections.some(({ classId }) => classId === id),
  );
  const validTariffs = tariffs.filter(
    ({ validFrom, validTo }) =>
      validFrom.slice(0, 7) <= period && (!validTo || validTo.slice(0, 7) >= period),
  );

  const setField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };
  const addClass = () => {
    const academicClass = availableClasses[0];
    const tariff = validTariffs[0];
    if (academicClass && tariff)
      setSelections((current) => [...current, { classId: academicClass.id, tariffId: tariff.id }]);
  };
  const updateSelection = (index: number, value: Partial<OnboardingSelection>) =>
    setSelections((current) =>
      current.map((item, position) => (position === index ? { ...item, ...value } : item)),
    );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || conflict) return;
    setSubmitting(true);
    setMessage('');
    setFieldErrors({});
    try {
      const payload = buildOnboardingPayload(
        form,
        selections,
        period,
        dueDate,
        collect,
        paymentMethod,
      );
      setResult(
        await apiRequest<StudentOnboardingResultDto>('/students/onboarding', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.field) setFieldErrors({ [error.field]: error.message });
        else setMessage(error.message);
      } else setMessage('No se pudo conectar con la API');
    } finally {
      setSubmitting(false);
    }
  }

  if (result)
    return (
      <section className="card onboarding-success">
        <p className="eyebrow">Alta completada</p>
        <h1>Alumno creado correctamente</h1>
        <p>
          {result.student.firstName} {result.student.lastName} · DNI {result.student.dni}
        </p>
        {result.enrollments.length > 0 && (
          <p>✓ {result.enrollments.length} inscripciones creadas</p>
        )}
        {result.charges.length > 0 && (
          <p>
            ✓ {result.charges.length} cuotas por{' '}
            {money(
              result.charges.reduce((sum, charge) => sum + Number(charge.studentDueAmount), 0),
            )}
          </p>
        )}
        <p>
          {result.payment
            ? `✓ Pago confirmado por ${money(result.payment.amount)}`
            : result.charges.length
              ? 'Las cuotas quedaron pendientes.'
              : 'Alta simple, sin inscripción inicial.'}
        </p>
        <div className="actions">
          {!result.payment && result.charges.length > 0 && (
            <Link className="button secondary" href={`/payments?studentId=${result.student.id}`}>
              Registrar pago
            </Link>
          )}
          <Link className="button" href={`/students/${result.student.id}`}>
            Ver ficha del alumno
          </Link>
        </div>
      </section>
    );

  return (
    <>
      <div className="page-heading">
        <div>
          <Link className="back-link" href="/students">
            ← Volver al listado
          </Link>
          <h1>Nuevo alumno</h1>
          <p className="subtitle">
            Creá el alumno y, opcionalmente, su inscripción y pago inicial.
          </p>
        </div>
      </div>
      <form className="onboarding-form" onSubmit={submit} noValidate>
        <section className="card">
          <h2>Datos personales</h2>
          <div className="student-form">
            {(['dni', 'firstName', 'lastName'] as const).map((field) => (
              <label key={field}>
                {field === 'dni' ? 'DNI' : field === 'firstName' ? 'Nombre' : 'Apellido'}
                <input
                  required
                  aria-invalid={Boolean(fieldErrors[field])}
                  value={form[field]}
                  onChange={(event) => setField(field, event.target.value)}
                />
                {fieldErrors[field] && <span className="field-error">{fieldErrors[field]}</span>}
              </label>
            ))}
            <label>
              Fecha de nacimiento <span className="optional">Opcional</span>
              <input
                type="date"
                value={form.birthDate}
                onChange={(event) => setField('birthDate', event.target.value)}
              />
            </label>
            <label>
              Teléfono <span className="optional">Opcional</span>
              <input
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
              />
            </label>
            <label>
              Correo <span className="optional">Opcional</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </label>
            <label className="wide">
              Domicilio <span className="optional">Opcional</span>
              <input
                value={form.address}
                onChange={(event) => setField('address', event.target.value)}
              />
            </label>
          </div>
        </section>
        <section className="card">
          <div className="onboarding-heading">
            <div>
              <h2>Inscripción inicial</h2>
              <p className="subtitle">Podés crear el alumno sin inscribirlo todavía.</p>
            </div>
            <button
              type="button"
              className="secondary"
              disabled={loadingOptions || !availableClasses.length || !validTariffs.length}
              onClick={addClass}
            >
              + Agregar clase
            </button>
          </div>
          <div className="onboarding-classes">
            {selections.map((selection, index) => {
              const academicClass = classes.find(({ id }) => id === selection.classId);
              return (
                <article className="enrollment-card" key={`${selection.classId}-${index}`}>
                  <div className="onboarding-heading">
                    <h3>Clase {index + 1}</h3>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setSelections((current) =>
                          current.filter((_, position) => position !== index),
                        )
                      }
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="onboarding-fields">
                    <label>
                      Clase
                      <select
                        value={selection.classId}
                        onChange={(event) =>
                          updateSelection(index, { classId: event.target.value })
                        }
                      >
                        {classes
                          .filter(
                            ({ id }) =>
                              id === selection.classId ||
                              !selections.some(({ classId }) => classId === id),
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} · {item.danceType.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Tarifa
                      <select
                        value={selection.tariffId}
                        onChange={(event) =>
                          updateSelection(index, { tariffId: event.target.value })
                        }
                      >
                        {validTariffs.map((tariff) => (
                          <option key={tariff.id} value={tariff.id}>
                            {tariff.name} · {money(tariff.amount)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {academicClass && (
                    <p className="class-summary">
                      {academicClass.teacher.firstName} {academicClass.teacher.lastName} ·{' '}
                      {academicClass.schedules
                        .map(
                          (schedule) =>
                            `${dayLabels[schedule.dayOfWeek]} ${schedule.startTime}–${schedule.endTime} · ${schedule.room.branch.name}/${schedule.room.name}`,
                        )
                        .join(' · ')}{' '}
                      · Cupo {academicClass.activeEnrollmentCount ?? 0}/{academicClass.capacity}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
          {conflict && (
            <p className="message" role="alert">
              Estas clases se superponen: {conflict[0].name} y {conflict[1].name}.
            </p>
          )}
        </section>
        {selections.length > 0 && (
          <section className="card">
            <h2>Cuotas iniciales</h2>
            <div className="onboarding-period">
              <label>
                Período
                <input
                  type="month"
                  required
                  value={period}
                  onChange={(event) => {
                    setPeriod(event.target.value);
                    setDueDate(`${event.target.value}-10`);
                  }}
                />
              </label>
              <label>
                Vencimiento
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
            </div>
            <div className="charge-summary">
              {selections.map((selection) => (
                <p key={selection.classId}>
                  <span>
                    {classes.find(({ id }) => id === selection.classId)?.name} ·{' '}
                    {periodLabel(period)}
                  </span>
                  <strong>
                    {money(tariffs.find(({ id }) => id === selection.tariffId)?.amount ?? 0)}
                  </strong>
                </p>
              ))}
              <p className="charge-total">
                <span>
                  {selections.length} cuota{selections.length === 1 ? '' : 's'} · Total estimado
                </span>
                <strong>{money(total)}</strong>
              </p>
              <small>El total es informativo; el backend calcula el importe definitivo.</small>
            </div>
            <h2 className="section-title">Pago inicial</h2>
            <div className="payment-options">
              <label>
                <input
                  type="radio"
                  name="collect"
                  checked={!collect}
                  onChange={() => setCollect(false)}
                />{' '}
                Dejar cuotas pendientes
              </label>
              <label>
                <input
                  type="radio"
                  name="collect"
                  checked={collect}
                  onChange={() => setCollect(true)}
                />{' '}
                Cobrar ahora
              </label>
              {collect && (
                <label>
                  Medio de pago
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as PaymentMethodDto)}
                  >
                    <option value="CASH">Efectivo</option>
                    <option value="MERCADO_PAGO">Mercado Pago</option>
                    <option value="CARD">Tarjeta</option>
                  </select>
                </label>
              )}
            </div>
          </section>
        )}
        {message && (
          <p className="message" role="alert">
            {message}
          </p>
        )}
        <div className="actions">
          <button disabled={submitting || Boolean(conflict)} type="submit">
            {submitting
              ? 'Creando alumno…'
              : selections.length === 0
                ? 'Crear alumno'
                : collect
                  ? 'Crear alumno y registrar pago'
                  : 'Crear alumno e inscribir'}
          </button>
          <Link className="button secondary" href="/students">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
