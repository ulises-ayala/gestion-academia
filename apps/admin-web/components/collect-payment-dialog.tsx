'use client';

import type {
  CashShiftDto,
  ClassListDto,
  EnrollmentListDto,
  MonthlyChargeDto,
  MonthlyChargeListDto,
  OtherPaymentConceptDto,
  PaymentDto,
  StudentDto,
  StudentListDto,
} from '@academy/contracts';
import { Check, Search } from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import {
  amountInputValue,
  chargeLabel,
  chargesProblem,
  emptyTenders,
  historicalDebtPayload,
  historicalDebtProblem,
  isOpenCharge,
  money,
  normalizeAmount,
  paymentSummary,
  pickIsInvalid,
  pickTotalCents,
  tenderModeLabels,
  tenderModes,
  tendersFrom,
  type CollectTab,
  type TenderPick,
} from '../lib/collect-payment';
import {
  buildOtherPaymentPayload,
  otherConceptLabels,
  otherPaymentProblem,
} from '../lib/other-payment';
import {
  centsToDecimal,
  createPaymentPayload,
  decimalToCents,
  paymentMethodLabels,
  previewAllocations,
  type TenderAmounts,
} from '../lib/payments';
import { useAuth } from './auth-provider';
import { GenerateChargeDialog } from './generate-charge-dialog';

const freshPick = (amount = ''): TenderPick => ({ mode: 'CASH', amount, split: emptyTenders });
const shortDate = (value: string) =>
  new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
const errorText = (error: unknown, fallback: string) =>
  error instanceof ApiClientError ? error.message : fallback;

/**
 * "Registrar pago": buscar al alumno y cobrarle en el mismo lugar, sin cambiar de pantalla.
 * Cuotas pendientes (o generar la que viene a pagar), clase suelta u otro concepto, y la deuda
 * anterior que el sistema todavía no tiene.
 */
export function CollectPaymentDialog({
  initialStudent = null,
  onClose,
}: Readonly<{ initialStudent?: StudentDto | null; onClose(changed: boolean): void }>) {
  const { can } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const [changed, setChanged] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly StudentDto[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [student, setStudent] = useState<StudentDto | null>(initialStudent);
  const [charges, setCharges] = useState<readonly MonthlyChargeDto[] | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentListDto['items']>([]);
  const [classes, setClasses] = useState<ClassListDto['items'] | null>(null);
  const [cashOpen, setCashOpen] = useState<boolean | null>(null);
  const [openingCash, setOpeningCash] = useState(false);
  const [tab, setTab] = useState<CollectTab>('charges');
  const [pick, setPick] = useState<TenderPick>(freshPick());
  const [amountTouched, setAmountTouched] = useState(false);
  const [concept, setConcept] = useState<OtherPaymentConceptDto>('SINGLE_CLASS');
  const [classId, setClassId] = useState('');
  const [detail, setDetail] = useState('');
  const [debtForm, setDebtForm] = useState({ enrollmentId: '', amount: '', description: '' });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<PaymentDto | null>(null);

  const close = () => {
    if (!saving) onClose(changed);
  };

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    // El diálogo enfoca su primer botón (Cerrar); el buscador queda listo para escribir.
    searchInput.current?.focus();
    return () => {
      element?.close();
      opener?.focus();
    };
  }, []);

  // Búsqueda por nombre o DNI mientras se escribe.
  useEffect(() => {
    if (student) return;
    const text = query.trim();
    if (text.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    let active = true;
    const timeout = window.setTimeout(() => {
      apiRequest<StudentListDto>(`/students?q=${encodeURIComponent(text)}&pageSize=8`)
        .then((result) => {
          if (!active) return;
          setResults(result.items);
          setHighlight(0);
        })
        .catch((caught) => active && setError(errorText(caught, 'No se pudo buscar alumnos.')))
        .finally(() => active && setSearching(false));
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [query, student]);

  const loadCharges = useCallback(async (studentId: string) => {
    const result = await apiRequest<MonthlyChargeListDto>(
      `/monthly-charges?studentId=${studentId}`,
    );
    setCharges(result.items);
    return result.items;
  }, []);

  // Al elegir al alumno: cuotas, inscripciones y caja, todo junto.
  useEffect(() => {
    if (!student) return;
    let active = true;
    setCharges(null);
    setError('');
    loadCharges(student.id).catch(
      (caught) => active && setError(errorText(caught, 'No se pudo cargar la deuda del alumno.')),
    );
    apiRequest<EnrollmentListDto>(`/enrollments?studentId=${student.id}&pageSize=100`)
      .then((result) => {
        if (!active) return;
        setEnrollments(result.items);
        const preferred =
          result.items.find((item) => item.status === 'ACTIVE') ?? result.items[0] ?? null;
        setDebtForm((form) => ({
          ...form,
          enrollmentId: form.enrollmentId || preferred?.id || '',
        }));
      })
      .catch(() => active && setEnrollments([]));
    apiRequest<CashShiftDto | null>('/cash-shifts/current')
      .then((shift) => active && setCashOpen(Boolean(shift)))
      .catch(() => active && setCashOpen(false));
    return () => {
      active = false;
    };
  }, [loadCharges, student]);

  useEffect(() => {
    if (tab !== 'other' || classes !== null) return;
    apiRequest<ClassListDto>('/classes?status=ACTIVE&pageSize=100')
      .then((result) => setClasses(result.items))
      .catch(() => setClasses([]));
  }, [classes, tab]);

  const pending = useMemo(
    () =>
      [...(charges ?? [])]
        .filter(isOpenCharge)
        .sort(
          (left, right) =>
            left.dueDate.localeCompare(right.dueDate) ||
            left.createdAt.localeCompare(right.createdAt) ||
            left.id.localeCompare(right.id),
        ),
    [charges],
  );
  const debtCents = pending.reduce(
    (sum, charge) => sum + (decimalToCents(charge.outstandingAmount) ?? 0n),
    0n,
  );
  const debt = centsToDecimal(debtCents);

  // Por defecto se cobra toda la deuda; la recepcionista puede bajar el importe (pago parcial).
  useEffect(() => {
    if (charges && !amountTouched)
      setPick((current) => ({ ...current, amount: amountInputValue(debtCents) }));
  }, [amountTouched, charges, debtCents]);

  useEffect(() => {
    if (student && charges && tab === 'charges' && !done) amountInput.current?.focus();
  }, [charges, done, student, tab]);

  const totalCents = pickTotalCents(pick);
  const preview = previewAllocations(pending, totalCents);
  const tenders: TenderAmounts = tendersFrom(pick);
  const otherForm = { concept, classId, detail };
  const problem =
    tab === 'charges'
      ? chargesProblem(pick, debtCents)
      : tab === 'other'
        ? pickIsInvalid(pick)
          ? 'Usá importes positivos con hasta dos decimales.'
          : otherPaymentProblem(otherForm, tenders)
        : historicalDebtProblem(debtForm);

  const selectStudent = (next: StudentDto) => {
    setStudent(next);
    setResults(null);
    setQuery('');
    setTab('charges');
    setPick(freshPick());
    setAmountTouched(false);
    setDebtForm({ enrollmentId: '', amount: '', description: '' });
    setNotice('');
    setTried(false);
  };

  const backToSearch = () => {
    setStudent(null);
    setCharges(null);
    setEnrollments([]);
    setDone(null);
    setError('');
    setNotice('');
    window.setTimeout(() => searchInput.current?.focus(), 0);
  };

  const anotherForSameStudent = () => {
    if (!student) return;
    setDone(null);
    setPick(freshPick());
    setAmountTouched(false);
    setDetail('');
    setClassId('');
    setTried(false);
    setNotice('');
    void loadCharges(student.id).catch(() => undefined);
  };

  const switchTab = (next: CollectTab) => {
    setTab(next);
    setTried(false);
    setError('');
    setNotice('');
    if (next !== 'charges') setPick(freshPick());
    else setAmountTouched(false);
  };

  async function openCash() {
    setOpeningCash(true);
    setError('');
    try {
      await apiRequest('/cash-shifts/open', { method: 'POST', body: '{}' });
      setCashOpen(true);
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.status === 409) setCashOpen(true);
      else setError(errorText(caught, 'No se pudo abrir la caja.'));
    } finally {
      setOpeningCash(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (!student || problem || saving) return;
    if (tab !== 'debt' && !cashOpen) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (tab === 'debt') {
        await apiRequest<MonthlyChargeDto>('/monthly-charges/historical-debt', {
          method: 'POST',
          body: JSON.stringify(historicalDebtPayload(debtForm)),
        });
        setChanged(true);
        await loadCharges(student.id);
        setDebtForm((form) => ({ ...form, amount: '', description: '' }));
        setTab('charges');
        setTried(false);
        setPick(freshPick());
        setAmountTouched(false);
        setNotice('Deuda cargada. Ya podés cobrarla, toda o una parte.');
        return;
      }
      const payment =
        tab === 'charges'
          ? await apiRequest<PaymentDto>('/payments', {
              method: 'POST',
              body: JSON.stringify(createPaymentPayload(student.id, tenders)),
            })
          : await apiRequest<PaymentDto>('/payments/other', {
              method: 'POST',
              body: JSON.stringify(buildOtherPaymentPayload(student.id, otherForm, tenders)),
            });
      setChanged(true);
      setDone(payment);
      void loadCharges(student.id).catch(() => undefined);
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.error.code === 'CASH_SHIFT_REQUIRED')
        setCashOpen(false);
      const stale =
        caught instanceof ApiClientError &&
        (caught.error.code === 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE' ||
          caught.error.code === 'PAYMENT_NO_OUTSTANDING_BALANCE' ||
          caught.status === 409);
      if (stale && tab === 'charges') {
        await loadCharges(student.id).catch(() => undefined);
        setAmountTouched(false);
        setError(
          'La deuda cambió mientras cobrabas. Actualizamos el importe: revisalo y cobrá de nuevo.',
        );
      } else setError(errorText(caught, 'No se pudo registrar el cobro.'));
    } finally {
      setSaving(false);
    }
  }

  const tenderFields = (
    <fieldset className="collect-tenders" disabled={saving}>
      <legend>Medio de pago</legend>
      <div className="collect-methods" role="radiogroup" aria-label="Medio de pago">
        {tenderModes.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={pick.mode === mode}
            className={pick.mode === mode ? 'is-selected' : ''}
            onClick={() =>
              setPick((current) => ({
                ...current,
                mode,
                split:
                  mode === 'MIXED' && current.mode !== 'MIXED'
                    ? { ...emptyTenders, [current.mode]: current.amount }
                    : current.split,
              }))
            }
          >
            {tenderModeLabels[mode]}
          </button>
        ))}
      </div>
      {pick.mode === 'MIXED' ? (
        <div className="collect-split">
          {(Object.keys(paymentMethodLabels) as (keyof TenderAmounts)[]).map((method) => (
            <label key={method}>
              {paymentMethodLabels[method]}
              <input
                inputMode="decimal"
                placeholder="0,00"
                value={pick.split[method]}
                onChange={(event) => {
                  setAmountTouched(true);
                  setPick({ ...pick, split: { ...pick.split, [method]: event.target.value } });
                }}
              />
            </label>
          ))}
        </div>
      ) : null}
    </fieldset>
  );

  const amountField = (label: string) =>
    pick.mode === 'MIXED' ? null : (
      <label className="collect-amount">
        {label}
        <span className="collect-amount-input">
          <span aria-hidden="true">$</span>
          <input
            ref={amountInput}
            inputMode="decimal"
            placeholder="0,00"
            value={pick.amount}
            disabled={saving}
            aria-invalid={tried && Boolean(problem)}
            onChange={(event) => {
              setAmountTouched(true);
              setPick({ ...pick, amount: event.target.value });
            }}
          />
        </span>
      </label>
    );

  const cashBanner =
    tab !== 'debt' && cashOpen === false ? (
      <div className="collect-cash" role="status">
        <span>Tu turno de caja está cerrado: abrilo para cobrar.</span>
        {can('cash:manage') ? (
          <button type="button" disabled={openingCash} onClick={() => void openCash()}>
            {openingCash ? 'Abriendo…' : 'Abrir mi caja'}
          </button>
        ) : (
          <Link className="text-link" href="/cash">
            Ir a Caja
          </Link>
        )}
      </div>
    ) : null;

  const submitLabel =
    tab === 'debt'
      ? saving
        ? 'Cargando…'
        : 'Cargar deuda'
      : saving
        ? 'Cobrando…'
        : `Cobrar ${money(centsToDecimal(totalCents))}`;

  return (
    <dialog
      ref={dialog}
      className="modal card collect-dialog"
      aria-labelledby="collect-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!generating) close();
      }}
    >
      <header className="collect-header">
        <h2 id="collect-title">Registrar pago</h2>
        <button type="button" className="secondary" disabled={saving} onClick={close}>
          Cerrar
        </button>
      </header>

      {!student ? (
        <div className="collect-search">
          <label className="collect-search-field">
            <span className="sr-only">Buscar alumno</span>
            <Search aria-hidden="true" size={18} />
            <input
              ref={searchInput}
              autoFocus
              type="search"
              value={query}
              placeholder="Buscá por nombre, apellido o DNI"
              aria-controls="collect-results"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (!results?.length) return;
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setHighlight((index) => Math.min(index + 1, results.length - 1));
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setHighlight((index) => Math.max(index - 1, 0));
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  const chosen = results[highlight];
                  if (chosen) selectStudent(chosen);
                }
              }}
            />
          </label>
          <div id="collect-results" className="collect-results" aria-live="polite">
            {query.trim().length < 2 ? (
              <p className="modal-copy">Escribí al menos dos letras o números del DNI.</p>
            ) : searching && !results ? (
              <p className="modal-copy">Buscando…</p>
            ) : results && results.length === 0 ? (
              <p className="modal-copy">
                No hay alumnos con “{query.trim()}”.{' '}
                {can('students:manage') && (
                  <Link className="text-link" href="/students/new">
                    Dar de alta un alumno
                  </Link>
                )}
              </p>
            ) : (
              results?.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`collect-result ${index === highlight ? 'is-highlighted' : ''}`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => selectStudent(item)}
                >
                  <strong>
                    {item.firstName} {item.lastName}
                  </strong>
                  <span>
                    DNI {item.dni}
                    {item.status === 'INACTIVE' ? ' · inactivo' : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : done ? (
        <div className="collect-done" role="status">
          <span className="collect-done-icon" aria-hidden="true">
            <Check size={28} />
          </span>
          <h3>Cobro registrado</h3>
          <p className="collect-done-amount">{paymentSummary(done).amount}</p>
          <p className="modal-copy">
            {student.firstName} {student.lastName} · {paymentSummary(done).methods}
          </p>
          <p className="modal-copy">{paymentSummary(done).detail}</p>
          {charges && (
            <p className="collect-done-balance">
              {debtCents > 0n ? `Le queda por pagar ${money(debt)}.` : 'Queda al día.'}
            </p>
          )}
          <div className="modal-actions collect-done-actions">
            <button type="button" className="secondary" onClick={() => onClose(true)}>
              Terminar
            </button>
            <button type="button" className="secondary" onClick={backToSearch}>
              Cobrar a otro alumno
            </button>
            <button type="button" onClick={anotherForSameStudent}>
              Cobrar otra cosa a {student.firstName}
            </button>
          </div>
        </div>
      ) : (
        <form className="collect-form" onSubmit={(event) => void submit(event)} noValidate>
          <div className="collect-student">
            <div>
              <strong>
                {student.firstName} {student.lastName}
              </strong>
              <span>
                DNI {student.dni} ·{' '}
                {charges === null
                  ? 'calculando deuda…'
                  : debtCents > 0n
                    ? `debe ${money(debt)}`
                    : 'al día'}
              </span>
            </div>
            <div className="collect-student-links">
              <Link className="text-link" href={`/students/${student.id}`}>
                Ver ficha
              </Link>
              <button
                type="button"
                className="link-button"
                disabled={saving}
                onClick={backToSearch}
              >
                Cambiar alumno
              </button>
            </div>
          </div>

          <div className="collect-tabs" role="tablist" aria-label="Qué cobrar">
            {(
              [
                ['charges', 'Cuotas'],
                ['other', 'Clase suelta u otro'],
                ...(can('charges:generate') ? [['debt', 'Deuda anterior']] : []),
              ] as [CollectTab, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? 'is-selected' : ''}
                disabled={saving}
                onClick={() => switchTab(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {notice && (
            <p className="collect-notice" role="status">
              {notice}
            </p>
          )}

          {tab === 'charges' && (
            <div className="collect-panel" role="tabpanel">
              {charges === null ? (
                <p className="modal-copy">Cargando cuotas…</p>
              ) : pending.length === 0 ? (
                <p className="collect-empty">
                  Está al día: no tiene cuotas pendientes. Si viene a pagar un mes, generá la cuota.
                </p>
              ) : (
                <ul className="collect-charges">
                  {pending.map((charge) => {
                    const applied = preview.find((item) => item.charge.id === charge.id);
                    return (
                      <li key={charge.id} className={applied ? 'is-applied' : ''}>
                        <span>
                          <strong>{chargeLabel(charge)}</strong>
                          <small>
                            {charge.academicClass.name}
                            {charge.kind === 'MONTHLY'
                              ? ` · vence ${shortDate(charge.dueDate)}`
                              : ''}
                            {charge.overdue && charge.kind === 'MONTHLY' ? ' · vencida' : ''}
                            {charge.status === 'PARTIAL' ? ' · pago parcial' : ''}
                          </small>
                        </span>
                        <span className="collect-charge-amount">
                          {money(charge.outstandingAmount)}
                          {applied && applied.amount !== charge.outstandingAmount && (
                            <small>cobra {money(applied.amount)}</small>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {can('charges:generate') && (
                <button
                  type="button"
                  className="secondary collect-generate"
                  disabled={saving || charges === null}
                  onClick={() => setGenerating(true)}
                >
                  {pending.length === 0 ? 'Generar cuota' : 'Generar otra cuota (mes adelantado)'}
                </button>
              )}
              {pending.length > 0 && (
                <>
                  {amountField('Importe que paga')}
                  {tenderFields}
                </>
              )}
            </div>
          )}

          {tab === 'other' && (
            <div className="collect-panel" role="tabpanel">
              <fieldset className="collect-concepts" disabled={saving}>
                <legend className="sr-only">¿A qué corresponde?</legend>
                {(Object.keys(otherConceptLabels) as OtherPaymentConceptDto[]).map((value) => (
                  <label key={value} className={concept === value ? 'is-selected' : ''}>
                    <input
                      type="radio"
                      name="collect-concept"
                      checked={concept === value}
                      onChange={() => setConcept(value)}
                    />
                    {otherConceptLabels[value]}
                  </label>
                ))}
              </fieldset>
              {concept === 'SINGLE_CLASS' && (
                <label>
                  Clase
                  <select
                    value={classId}
                    disabled={saving || classes === null}
                    aria-invalid={tried && !classId}
                    onChange={(event) => setClassId(event.target.value)}
                  >
                    <option value="">
                      {classes === null ? 'Cargando clases…' : 'Elegí la clase'}
                    </option>
                    {classes?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · Prof. {item.teacher.firstName} {item.teacher.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                {concept === 'OTHER' ? 'Detalle' : 'Detalle (opcional)'}
                <input
                  maxLength={200}
                  value={detail}
                  disabled={saving}
                  placeholder={concept === 'OTHER' ? 'Ej.: remera del show, seña de vestuario' : ''}
                  aria-invalid={tried && concept === 'OTHER' && detail.trim().length < 3}
                  onChange={(event) => setDetail(event.target.value)}
                />
              </label>
              {amountField('Importe')}
              {tenderFields}
            </div>
          )}

          {tab === 'debt' && (
            <div className="collect-panel" role="tabpanel">
              <p className="modal-copy">
                Para deuda que el alumno ya tenía y no figura en el sistema (por ejemplo, la que no
                trajo ControlFit). Se carga como un monto único, sin recargo, y después se cobra
                como cualquier cuota, toda o una parte.
              </p>
              {enrollments.length === 0 ? (
                <p className="collect-empty">
                  El alumno no tiene inscripciones: inscribilo en su clase antes de cargar la deuda.
                </p>
              ) : (
                <label>
                  Clase
                  <select
                    value={debtForm.enrollmentId}
                    disabled={saving}
                    onChange={(event) =>
                      setDebtForm({ ...debtForm, enrollmentId: event.target.value })
                    }
                  >
                    {enrollments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.academicClass.name}
                        {item.status === 'ACTIVE' ? '' : ' (inscripción finalizada)'}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                A qué corresponde
                <input
                  maxLength={200}
                  value={debtForm.description}
                  disabled={saving}
                  placeholder="Ej.: ControlFit, julio a septiembre"
                  aria-invalid={tried && debtForm.description.trim().length < 3}
                  onChange={(event) =>
                    setDebtForm({ ...debtForm, description: event.target.value })
                  }
                />
              </label>
              <label className="collect-amount">
                Monto de la deuda
                <span className="collect-amount-input">
                  <span aria-hidden="true">$</span>
                  <input
                    inputMode="decimal"
                    placeholder="0,00"
                    value={debtForm.amount}
                    disabled={saving}
                    aria-invalid={tried && !decimalToCents(normalizeAmount(debtForm.amount) || 'x')}
                    onChange={(event) => setDebtForm({ ...debtForm, amount: event.target.value })}
                  />
                </span>
              </label>
            </div>
          )}

          {cashBanner}
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
          {!(tab === 'charges' && pending.length === 0) && (
            <div className="modal-actions collect-actions">
              <button
                type="submit"
                className="collect-submit"
                disabled={
                  saving ||
                  (tab === 'debt'
                    ? enrollments.length === 0
                    : cashOpen !== true || totalCents <= 0n)
                }
              >
                {submitLabel}
              </button>
            </div>
          )}
        </form>
      )}

      {generating && student && charges && (
        <GenerateChargeDialog
          studentId={student.id}
          studentName={`${student.firstName} ${student.lastName}`}
          charges={charges}
          canBackfill={can('charges:manage')}
          canCollect={false}
          canManageTariffs={can('tariffs:manage')}
          paymentStep={false}
          onClose={() => setGenerating(false)}
          onDone={(result) => {
            setGenerating(false);
            setChanged(true);
            setAmountTouched(false);
            setNotice(`${result.title}. Ya podés cobrarla.`);
            void loadCharges(student.id).catch(() => undefined);
          }}
        />
      )}
    </dialog>
  );
}
