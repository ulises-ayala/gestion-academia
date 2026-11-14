'use client';

import type {
  ClassDto,
  ClassListDto,
  CashShiftDto,
  CreateStudentDto,
  LeadDto,
  LeadTrialClassDto,
  PaymentMethodDto,
  StudentOnboardingResultDto,
  TariffDto,
} from '@academy/contracts';
import Link from 'next/link';
import React, {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { money } from '../lib/money';
import { notifyError, notifySuccess } from '../lib/notify';
import { classTeachersLabel, dayLabels } from '../lib/offering';
import {
  buildOnboardingPayload,
  classTariffsFor,
  onboardingTotal,
  type OnboardingSelection,
  selectedClassConflict,
  selectionFromTrials,
  studentDraftFromLead,
} from '../lib/student-onboarding';
import { useAuth } from './auth-provider';
import { LeadPicker } from './lead-picker';
import { TrialVisitForm } from './trial-visit-form';

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
  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year!, month! - 1, 1)));
};

/** Etiqueta de un campo con "Opcional" al lado, en la misma línea, para que todo quede alineado. */
export function FieldLabel({
  children,
  optional = false,
}: Readonly<{ children: ReactNode; optional?: boolean }>) {
  return (
    <span className="field-label">
      {children}
      {optional && <span className="optional">Opcional</span>}
    </span>
  );
}

export type OnboardingMode = 'enroll' | 'trial';

/**
 * Alta de alumno: se inscribe (alumno, inscripción, cuota y pago opcional) o viene a una clase de
 * prueba gratis (queda como potencial alumno). Se usa como popup (Inicio, Alumnos, Potenciales) y
 * como página (`/students/new`).
 */
export function StudentOnboarding({
  variant,
  initialLeadId = null,
  initialMode = 'enroll',
  onClose,
  onChanged,
}: Readonly<{
  variant: 'page' | 'dialog';
  /** Viene de un potencial alumno: el alta se precarga con sus datos. */
  initialLeadId?: string | null;
  initialMode?: OnboardingMode;
  /** Solo en el popup. */
  onClose?(): void;
  /** Se creó un alumno o se registró una prueba. */
  onChanged?(): void;
}>) {
  const { can } = useAuth();
  const dialog = variant === 'dialog';
  const [leadId, setLeadId] = useState<string | null>(initialLeadId);
  const [mode, setMode] = useState<OnboardingMode>(initialLeadId ? 'enroll' : initialMode);
  const [lead, setLead] = useState<LeadDto | null>(null);
  const [leadTrials, setLeadTrials] = useState<readonly LeadTrialClassDto[]>([]);
  const [leadError, setLeadError] = useState('');
  const trialApplied = useRef(false);
  const [form, setForm] = useState(emptyForm);
  const [classes, setClasses] = useState<readonly ClassDto[]>([]);
  const [tariffs, setTariffs] = useState<readonly TariffDto[]>([]);
  const [selections, setSelections] = useState<readonly OnboardingSelection[]>([]);
  const [period, setPeriod] = useState(currentPeriod);
  const [dueDate, setDueDate] = useState(`${currentPeriod()}-10`);
  const [collect, setCollect] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodDto>('CASH');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<StudentOnboardingResultDto | null>(null);
  const [cashShiftOpen, setCashShiftOpen] = useState(false);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    setOptionsError('');
    try {
      const [classList, activeTariffs] = await Promise.all([
        apiRequest<ClassListDto>('/classes?status=ACTIVE&pageSize=100'),
        apiRequest<readonly TariffDto[]>('/tariffs/active'),
      ]);
      setClasses(classList.items);
      setTariffs(activeTariffs);
    } catch (error) {
      setOptionsError(
        error instanceof ApiClientError
          ? error.message
          : 'No se pudieron cargar las clases y tarifas. Verificá la conexión e intentá nuevamente.',
      );
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  // Alta de un potencial alumno: sus datos y la clase que probó.
  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    setLeadError('');
    Promise.all([
      apiRequest<LeadDto>(`/leads/${leadId}`),
      apiRequest<LeadTrialClassDto[]>(`/leads/${leadId}/trial-classes`),
    ])
      .then(([loaded, trials]) => {
        if (cancelled) return;
        setLead(loaded);
        setLeadTrials(trials);
        if (!loaded.studentId)
          setForm((current) => ({ ...current, ...studentDraftFromLead(loaded) }));
      })
      .catch(
        (error) =>
          !cancelled &&
          setLeadError(
            error instanceof ApiClientError
              ? error.message
              : 'No se pudo cargar el potencial alumno.',
          ),
      );
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  // La clase que probó queda elegida, con su tarifa, en cuanto están las clases y las tarifas.
  useEffect(() => {
    if (trialApplied.current || !lead || lead.studentId || loadingOptions || !classes.length)
      return;
    trialApplied.current = true;
    const selection = selectionFromTrials(leadTrials, classes, tariffs, period);
    if (selection) setSelections((current) => (current.length ? current : [selection]));
  }, [lead, leadTrials, classes, tariffs, period, loadingOptions]);

  useEffect(() => {
    void loadOptions();
    apiRequest<CashShiftDto | null>('/cash-shifts/current')
      .then((cashShift) => setCashShiftOpen(Boolean(cashShift)))
      .catch(() => setCashShiftOpen(false));
  }, [loadOptions]);

  const conflict = useMemo(() => selectedClassConflict(selections, classes), [selections, classes]);
  const total = onboardingTotal(selections, tariffs);
  // Clases que todavía no se eligieron y tienen alguna tarifa para el mes.
  const availableClasses = classes.filter(
    ({ id }) =>
      !selections.some(({ classId }) => classId === id) &&
      classTariffsFor(tariffs, id, period).length > 0,
  );
  const convertsLead = Boolean(lead && !lead.studentId);
  const canPickLead = !initialLeadId && can('leads:manage');

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
    const tariff = academicClass && classTariffsFor(tariffs, academicClass.id, period)[0];
    if (academicClass && tariff)
      setSelections((current) => [...current, { classId: academicClass.id, tariffId: tariff.id }]);
  };
  const updateSelection = (index: number, value: Partial<OnboardingSelection>) =>
    setSelections((current) =>
      current.map((item, position) => (position === index ? { ...item, ...value } : item)),
    );
  const pickLead = (picked: LeadDto) => {
    trialApplied.current = false;
    setLead(null);
    setLeadTrials([]);
    setLeadId(picked.id);
  };

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
        convertsLead ? lead!.id : null,
      );
      const res = await apiRequest<StudentOnboardingResultDto>('/students/onboarding', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult(res);
      onChanged?.();
      notifySuccess(
        'Alumno registrado con éxito',
        `${res.student.firstName} ${res.student.lastName} (DNI ${res.student.dni})${
          res.enrollments.length > 0 ? ` · ${res.enrollments.length} inscripción(es)` : ''
        }`,
      );
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.field) setFieldErrors({ [error.field]: error.message });
        else setMessage(error.message);
      } else {
        setMessage('No se pudo conectar con la API');
      }
      notifyError(error, 'Fallo al registrar el alumno');
    } finally {
      setSubmitting(false);
    }
  }

  const closeButton = dialog && (
    <button className="secondary" type="button" onClick={onClose}>
      Cerrar
    </button>
  );

  if (result)
    return (
      <section className="card onboarding-success">
        <p className="eyebrow">Alta completada</p>
        <h2 id="student-onboarding-title">Alumno creado correctamente</h2>
        <p>
          {result.student.firstName} {result.student.lastName} · DNI {result.student.dni}
        </p>
        {convertsLead && <p>✓ {lead!.name} quedó como inscripto/a en Potenciales</p>}
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
          {closeButton}
        </div>
      </section>
    );

  const trial = mode === 'trial';
  const title = trial ? 'Clase de prueba' : 'Nuevo alumno';
  const subtitle = trial
    ? 'Registrá a quien viene a probar una clase gratis. Queda como potencial alumno.'
    : 'Creá el alumno y, opcionalmente, su inscripción y pago inicial.';

  return (
    <>
      {dialog ? (
        <header className="student-dialog-header">
          <div>
            <h2 id="student-onboarding-title">{title}</h2>
            <p className="modal-copy">{subtitle}</p>
          </div>
          {closeButton}
        </header>
      ) : (
        <div className="page-heading">
          <div>
            <Link className="back-link" href="/students">
              ← Volver al listado
            </Link>
            <h1 id="student-onboarding-title">{title}</h1>
            <p className="subtitle">{subtitle}</p>
          </div>
        </div>
      )}
      {canPickLead && (
        <div aria-label="Cómo viene" className="onboarding-mode" role="group">
          <button
            aria-pressed={!trial}
            className="secondary"
            onClick={() => setMode('enroll')}
            type="button"
          >
            Se inscribe
          </button>
          <button
            aria-pressed={trial}
            className="secondary"
            onClick={() => setMode('trial')}
            type="button"
          >
            Clase de prueba
          </button>
        </div>
      )}
      {trial ? (
        <TrialVisitForm
          classes={classes}
          loadingClasses={loadingOptions}
          onChanged={onChanged}
          onClose={dialog ? onClose : undefined}
        />
      ) : (
        <>
          {canPickLead && !lead && <LeadPicker onPick={pickLead} />}
          {leadError && (
            <p className="message" role="alert">
              {leadError}
            </p>
          )}
          {lead && (
            <section className="onboarding-lead" aria-label="Potencial alumno">
              {lead.studentId ? (
                <p>
                  <strong>{lead.name}</strong> ya se inscribió como alumno.{' '}
                  <Link className="text-link" href={`/students/${lead.studentId}`}>
                    Ver su ficha
                  </Link>
                </p>
              ) : (
                <p>
                  Datos de <strong>{lead.name}</strong>, potencial alumno. Revisá el nombre y el
                  apellido, completá el DNI
                  {leadTrials.length > 0 ? ' y confirmá la clase que probó' : ''}. Al crear el
                  alumno, queda como inscripto/a en Potenciales.{' '}
                  <Link className="text-link" href={`/leads/${lead.id}`}>
                    Ver potencial
                  </Link>
                </p>
              )}
            </section>
          )}
          <form className="onboarding-form" onSubmit={submit} noValidate>
            <section className="card">
              <h2 className="onboarding-section-title">Datos personales</h2>
              <div className="student-form">
                {(['dni', 'firstName', 'lastName'] as const).map((field) => (
                  <label key={field}>
                    <FieldLabel>
                      {field === 'dni' ? 'DNI' : field === 'firstName' ? 'Nombre' : 'Apellido'}
                    </FieldLabel>
                    <input
                      required
                      aria-invalid={Boolean(fieldErrors[field])}
                      value={form[field]}
                      onChange={(event) => setField(field, event.target.value)}
                    />
                    {fieldErrors[field] && (
                      <span className="field-error">{fieldErrors[field]}</span>
                    )}
                  </label>
                ))}
                <label>
                  <FieldLabel optional>Fecha de nacimiento</FieldLabel>
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(event) => setField('birthDate', event.target.value)}
                  />
                </label>
                <label>
                  <FieldLabel optional>Teléfono</FieldLabel>
                  <input
                    inputMode="tel"
                    value={form.phone}
                    onChange={(event) => setField('phone', event.target.value)}
                  />
                </label>
                <label>
                  <FieldLabel optional>Correo</FieldLabel>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setField('email', event.target.value)}
                  />
                </label>
                <label className="wide">
                  <FieldLabel optional>Domicilio</FieldLabel>
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
                  disabled={loadingOptions || !availableClasses.length}
                  onClick={addClass}
                >
                  + Agregar clase
                </button>
              </div>
              <div className="onboarding-classes">
                {selections.map((selection, index) => {
                  const academicClass = classes.find(({ id }) => id === selection.classId);
                  const classTariffs = classTariffsFor(tariffs, selection.classId, period);
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
                          <FieldLabel>Clase</FieldLabel>
                          <select
                            value={selection.classId}
                            onChange={(event) =>
                              updateSelection(index, {
                                classId: event.target.value,
                                // La tarifa tiene que ser de la clase elegida.
                                tariffId:
                                  classTariffsFor(tariffs, event.target.value, period)[0]?.id ?? '',
                              })
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
                          <FieldLabel>Tarifa</FieldLabel>
                          <select
                            value={selection.tariffId}
                            onChange={(event) =>
                              updateSelection(index, { tariffId: event.target.value })
                            }
                          >
                            {classTariffs.length === 0 && (
                              <option value="">Sin tarifa para este mes</option>
                            )}
                            {classTariffs.map((tariff) => (
                              <option key={tariff.id} value={tariff.id}>
                                {tariff.name} · {money(tariff.amount)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {academicClass && (
                        <p className="class-summary">
                          {classTeachersLabel(academicClass)} ·{' '}
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
              {loadingOptions && <p className="subtitle">Cargando clases y tarifas…</p>}
              {optionsError && (
                <div className="module-state" role="alert">
                  <p>{optionsError}</p>
                  <button className="secondary" type="button" onClick={() => void loadOptions()}>
                    Reintentar
                  </button>
                </div>
              )}
              {conflict && (
                <p className="message" role="alert">
                  Estas clases se superponen: {conflict[0].name} y {conflict[1].name}.
                </p>
              )}
            </section>
            {selections.length > 0 && (
              <section className="card">
                <h2 className="onboarding-section-title">Cuotas iniciales</h2>
                <div className="onboarding-period">
                  <label>
                    <FieldLabel>Período</FieldLabel>
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
                    <FieldLabel>Vencimiento</FieldLabel>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                    />
                    <small>El día de este vencimiento queda como día de pago del alumno.</small>
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
                      disabled={!cashShiftOpen}
                      onChange={() => setCollect(true)}
                    />{' '}
                    Cobrar ahora
                  </label>
                  {!cashShiftOpen && (
                    <p>
                      Para cobrar ahora necesitás <Link href="/cash">abrir tu turno de caja</Link>.
                      Podés continuar el alta dejando las cuotas pendientes.
                    </p>
                  )}
                  {collect && (
                    <label>
                      <FieldLabel>Medio de pago</FieldLabel>
                      <select
                        value={paymentMethod}
                        onChange={(event) =>
                          setPaymentMethod(event.target.value as PaymentMethodDto)
                        }
                      >
                        <option value="CASH">Efectivo</option>
                        <option value="MERCADO_PAGO">Mercado Pago</option>
                        <option value="TRANSFER">Transferencia</option>
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
            <div className="actions onboarding-actions">
              <button disabled={submitting || Boolean(conflict)} type="submit">
                {submitting
                  ? 'Creando alumno…'
                  : selections.length === 0
                    ? 'Crear alumno'
                    : collect
                      ? 'Crear alumno y registrar pago'
                      : 'Crear alumno e inscribir'}
              </button>
              {dialog ? (
                <button className="secondary" type="button" onClick={onClose}>
                  Cancelar
                </button>
              ) : (
                <Link className="button secondary" href="/students">
                  Cancelar
                </Link>
              )}
            </div>
          </form>
        </>
      )}
    </>
  );
}
