'use client';

import type {
  ApplyCreditResultDto,
  CardTypeDto,
  CashShiftDto,
  ClassListDto,
  EnrollmentListDto,
  MonthlyChargeDto,
  MonthlyChargeListDto,
  OtherPaymentConceptDto,
  PaymentConceptDto,
  PaymentDto,
  PaymentSummaryDto,
  StudentDto,
  StudentListDto,
  TeacherListDto,
} from '@academy/contracts';
import { Check, Search } from 'lucide-react';
import Link from 'next/link';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { ApiClientError, apiRequest } from '../lib/api-client';
import { cardSurchargePreviewCents, cardTypeLabels } from '../lib/card-surcharge';
import { businessToday } from '../lib/dates';
import {
  amountInputValue,
  chargeLabel,
  optionalAmountCents,
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
  buildWalkInPaymentPayload,
  conceptOptions,
  otherPaymentProblem,
  walkInProblem,
  type WalkInForm,
} from '../lib/other-payment';
import {
  centsToDecimal,
  createPaymentPayload,
  decimalToCents,
  payerName,
  paymentMethodLabels,
  previewAllocations,
  type TenderAmounts,
} from '../lib/payments';
import { classTeachersLabel } from '../lib/offering';
import { whatsappNumber, whatsappReceiptUrl } from '../lib/whatsapp-receipt';
import { useAuth } from './auth-provider';
import { ChargeDueDateModal } from './charge-due-date-modal';
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
 *
 * variant="inline" es el mismo cobro dentro de una página (estado de cuenta del alumno): sin
 * buscador ni botón Cerrar, y avisa cada cambio con onChanged para refrescar el resto.
 */
export function CollectPaymentDialog({
  initialStudent = null,
  initialTab = 'charges',
  variant = 'dialog',
  refreshKey = 0,
  focusAmount = variant === 'dialog',
  chargeActions,
  onChanged,
  onClose,
}: Readonly<{
  initialStudent?: StudentDto | null;
  initialTab?: CollectTab;
  variant?: 'dialog' | 'inline';
  /** Al cambiar, vuelve a cargar las cuotas (la página tocó algo: anuló un pago, etc.). */
  refreshKey?: number;
  /** Enfocar el importe al cargar las cuotas. */
  focusAmount?: boolean;
  /** Acciones extra por cuota (p. ej. quitar recargo en el estado de cuenta). */
  chargeActions?: ((charge: MonthlyChargeDto) => ReactNode) | undefined;
  onChanged?(): void;
  onClose(changed: boolean): void;
}>) {
  const inline = variant === 'inline';
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
  // Alumno eventual: alguien que toma una clase suelta sin ser alumno (sin ficha ni cuotas).
  const [walkIn, setWalkIn] = useState<WalkInForm | null>(null);
  const walkInMode = walkIn !== null;
  const [charges, setCharges] = useState<readonly MonthlyChargeDto[] | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentListDto['items']>([]);
  const [classes, setClasses] = useState<ClassListDto['items'] | null>(null);
  const [cashOpen, setCashOpen] = useState<boolean | null>(null);
  const [openingCash, setOpeningCash] = useState(false);
  const [tab, setTab] = useState<CollectTab>(initialTab);
  const [pick, setPick] = useState<TenderPick>(freshPick());
  const [amountTouched, setAmountTouched] = useState(false);
  /** Cuotas que eligió Administración; vacío = desde la más vieja. */
  const [chosen, setChosen] = useState<readonly string[]>([]);
  /** Recargo por pagar con tarjeta (se registra aparte, como otro cobro). */
  /** Débito o crédito: define el recargo por pagar con tarjeta (lo calcula la API). */
  const [cardType, setCardType] = useState<CardTypeDto | null>(null);
  const [keepCredit, setKeepCredit] = useState(false);
  /** En "Clase suelta u otro": cuánto se paga con el saldo a favor del alumno. */
  const [creditUse, setCreditUse] = useState('');
  const [credit, setCredit] = useState('0.00');
  const [applyingCredit, setApplyingCredit] = useState(false);
  const [doneSurcharge, setDoneSurcharge] = useState<string | null>(null);
  const [concept, setConcept] = useState<OtherPaymentConceptDto>('SINGLE_CLASS');
  const [conceptId, setConceptId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<readonly PaymentConceptDto[] | null>(null);
  const [classId, setClassId] = useState('');
  const [teachers, setTeachers] = useState<TeacherListDto['items'] | null>(null);
  const [teacherId, setTeacherId] = useState('');
  const [detail, setDetail] = useState('');
  // Pagos cobrados antes y cargados tarde: Administración/Dirección ponen la fecha real.
  const today = businessToday();
  const [paidDate, setPaidDate] = useState(today);
  const dated = (payload: object) =>
    paidDate && paidDate !== today ? { ...payload, paidDate } : payload;
  const [debtForm, setDebtForm] = useState({ enrollmentId: '', amount: '', description: '' });
  const [generating, setGenerating] = useState(false);
  const [dueDateTarget, setDueDateTarget] = useState<MonthlyChargeDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<PaymentDto | null>(null);

  const close = () => {
    if (!saving) onClose(changed);
  };
  const markChanged = () => {
    setChanged(true);
    onChanged?.();
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

  // Cuotas y saldo a favor del alumno: se recargan juntos después de cada cambio.
  const loadCharges = useCallback(async (studentId: string) => {
    const [result, summary] = await Promise.all([
      apiRequest<MonthlyChargeListDto>(`/monthly-charges?studentId=${studentId}`),
      apiRequest<PaymentSummaryDto>(`/payments/summary?studentId=${studentId}`).catch(() => null),
    ]);
    setCharges(result.items);
    setCredit(summary?.creditTotal ?? '0.00');
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
    if (!walkInMode) return;
    let active = true;
    apiRequest<CashShiftDto | null>('/cash-shifts/current')
      .then((shift) => active && setCashOpen(Boolean(shift)))
      .catch(() => active && setCashOpen(false));
    return () => {
      active = false;
    };
  }, [walkInMode]);

  useEffect(() => {
    if (tab !== 'other' || classes !== null) return;
    apiRequest<ClassListDto>('/classes?status=ACTIVE&pageSize=100')
      .then((result) => setClasses(result.items))
      .catch(() => setClasses([]));
    apiRequest<TeacherListDto>('/teachers?status=ACTIVE&pageSize=100')
      .then((result) => setTeachers(result.items))
      .catch(() => setTeachers([]));
    apiRequest<PaymentConceptDto[]>('/payment-concepts')
      .then(setCatalog)
      .catch(() => setCatalog([]));
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
  const outstandingCents = (list: readonly MonthlyChargeDto[]) =>
    list.reduce((sum, charge) => sum + (decimalToCents(charge.outstandingAmount) ?? 0n), 0n);
  const debtCents = outstandingCents(pending);
  const debt = centsToDecimal(debtCents);
  // Administración y Dirección pueden elegir qué cuotas paga; si no eligen, desde la más vieja.
  // Con una sola cuota no hay qué elegir (y no queda una selección oculta).
  const canChoose = can('payments:void') && pending.length > 1;
  const chosenOpen = canChoose ? pending.filter((charge) => chosen.includes(charge.id)) : [];
  const payable = chosenOpen.length > 0 ? chosenOpen : pending;
  const payableCents = outstandingCents(payable);
  const toggleChosen = (id: string) => {
    setChosen((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    setAmountTouched(false);
  };

  // Por defecto se cobra toda la deuda (o lo de las cuotas elegidas); se puede bajar el importe.
  useEffect(() => {
    if (charges && !amountTouched)
      setPick((current) => ({ ...current, amount: amountInputValue(payableCents) }));
  }, [amountTouched, charges, payableCents]);

  useEffect(() => {
    if (focusAmount && student && charges && tab === 'charges' && !done)
      amountInput.current?.focus();
  }, [charges, done, focusAmount, student, tab]);

  const lastRefresh = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey === lastRefresh.current || !student) return;
    lastRefresh.current = refreshKey;
    setAmountTouched(false);
    void loadCharges(student.id).catch(() => undefined);
  }, [loadCharges, refreshKey, student]);

  const totalCents = pickTotalCents(pick);
  const preview = previewAllocations(payable, totalCents);
  const tenders: TenderAmounts = tendersFrom(pick);
  const options = conceptOptions(catalog ?? []);
  const selectedOption =
    options.find((option) => option.key === (concept === 'OTHER' ? conceptId : concept)) ?? null;
  const otherForm = {
    concept,
    conceptId,
    requiresDetail: selectedOption?.requiresDetail ?? false,
    classId,
    teacherId,
    detail,
  };
  const paysByCard = (decimalToCents(tenders.CARD || '0') ?? 0n) > 0n;
  const cardCents = decimalToCents(tenders.CARD || '0') ?? 0n;
  // En el recargo cargado a mano no se calcula otro recargo.
  const needsCardType =
    paysByCard && !walkInMode && !(tab === 'other' && concept === 'CARD_SURCHARGE');
  const surchargeCents =
    needsCardType && cardType ? cardSurchargePreviewCents(cardCents, cardType) : 0n;
  const cardTypeProblem =
    needsCardType && !cardType ? 'Elegí si la tarjeta es de débito o de crédito.' : null;
  const selectedClass = classes?.find((item) => item.id === classId) ?? null;
  const creditAvailableCents = decimalToCents(credit) ?? 0n;
  const canUseCredit = !walkInMode && concept !== 'CARD_SURCHARGE' && creditAvailableCents > 0n;
  const creditUseCents = canUseCredit ? optionalAmountCents(creditUse) : 0n;
  const otherProblem = pickIsInvalid(pick)
    ? 'Usá importes positivos con hasta dos decimales.'
    : otherPaymentProblem(otherForm, tenders, {
        usedCents: creditUseCents,
        availableCents: creditAvailableCents,
      });
  // Cobrar de más: el excedente queda como saldo a favor solo si quien cobra lo confirma.
  const excessCents = totalCents > payableCents ? totalCents - payableCents : 0n;
  const allowCredit = keepCredit && excessCents > 0n;
  const problem = walkIn
    ? (walkInProblem(walkIn) ?? otherProblem)
    : tab === 'charges'
      ? (chargesProblem(pick, payableCents, chosenOpen.length > 0, allowCredit) ?? cardTypeProblem)
      : tab === 'other'
        ? (otherProblem ?? cardTypeProblem)
        : historicalDebtProblem(debtForm);

  const selectStudent = (next: StudentDto) => {
    setStudent(next);
    setResults(null);
    setQuery('');
    setTab('charges');
    setPick(freshPick());
    setAmountTouched(false);
    setChosen([]);
    setCardType(null);
    setCreditUse('');
    setDebtForm({ enrollmentId: '', amount: '', description: '' });
    setNotice('');
    setTried(false);
  };

  const startWalkIn = () => {
    // Si escribió un nombre en el buscador, se usa como nombre del eventual.
    setWalkIn({ name: /\d/.test(query) ? '' : query.trim(), phone: '', dni: '' });
    setResults(null);
    setQuery('');
    setTab('other');
    setConcept('SINGLE_CLASS');
    setConceptId(null);
    setPick(freshPick());
    setTried(false);
    setNotice('');
    setError('');
  };

  const backToSearch = () => {
    setStudent(null);
    setWalkIn(null);
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
    setCardType(null);
    setCreditUse('');
    setPick(freshPick());
    setAmountTouched(false);
    setDetail('');
    setClassId('');
    setTeacherId('');
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

  // Usar el saldo a favor en las cuotas pendientes (de la más vieja): no pasa por la caja.
  async function applyCredit() {
    if (!student || applyingCredit) return;
    setApplyingCredit(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest<ApplyCreditResultDto>('/payments/apply-credit', {
        method: 'POST',
        body: JSON.stringify({ studentId: student.id }),
      });
      markChanged();
      setAmountTouched(false);
      setChosen([]);
      await loadCharges(student.id);
      setNotice(`Se usaron ${money(result.applied)} del saldo a favor en sus cuotas.`);
    } catch (caught) {
      setError(errorText(caught, 'No se pudo usar el saldo a favor.'));
    } finally {
      setApplyingCredit(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if ((!student && !walkIn) || problem || saving) return;
    if (tab !== 'debt' && !cashOpen) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (walkIn) {
        const payment = await apiRequest<PaymentDto>('/payments/other', {
          method: 'POST',
          body: JSON.stringify(dated(buildWalkInPaymentPayload(walkIn, otherForm, tenders))),
        });
        markChanged();
        setDoneSurcharge(null);
        setDone(payment);
        return;
      }
      if (!student) return;
      if (tab === 'debt') {
        await apiRequest<MonthlyChargeDto>('/monthly-charges/historical-debt', {
          method: 'POST',
          body: JSON.stringify(historicalDebtPayload(debtForm)),
        });
        markChanged();
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
              body: JSON.stringify(
                dated({
                  ...createPaymentPayload(student.id, tenders),
                  ...(chosenOpen.length > 0
                    ? { monthlyChargeIds: chosenOpen.map((charge) => charge.id) }
                    : {}),
                  ...(needsCardType && cardType ? { cardType } : {}),
                  ...(allowCredit ? { allowCredit: true } : {}),
                }),
              ),
            })
          : await apiRequest<PaymentDto>('/payments/other', {
              method: 'POST',
              body: JSON.stringify(
                dated({
                  ...buildOtherPaymentPayload(student.id, otherForm, tenders, creditUseCents ?? 0n),
                  ...(needsCardType && cardType ? { cardType } : {}),
                }),
              ),
            });
      markChanged();
      setChosen([]);
      setKeepCredit(false);
      setCreditUse('');
      // El recargo que vale es el que calculó la API.
      setDoneSurcharge(payment.cardSurcharge?.amount ?? null);
      setCardType(null);
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
      if (stale && tab === 'charges' && student) {
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

  // Al pagar con tarjeta: débito o crédito, con el recargo que se cobra aparte.
  const cardTypeFields = needsCardType ? (
    <fieldset className="collect-card-type" disabled={saving}>
      <legend>Tarjeta</legend>
      <div className="collect-concepts">
        {(Object.keys(cardTypeLabels) as CardTypeDto[]).map((value) => (
          <label key={value} className={cardType === value ? 'is-selected' : ''}>
            <input
              type="radio"
              name="collect-card-type"
              checked={cardType === value}
              onChange={() => setCardType(value)}
            />
            {cardTypeLabels[value]}
          </label>
        ))}
      </div>
      <small className="collect-hint">
        {cardType
          ? `Recargo ${money(centsToDecimal(surchargeCents))}: se cobra aparte con tarjeta (total con tarjeta ${money(centsToDecimal(cardCents + surchargeCents))}) y no entra en la liquidación del profesor.`
          : 'El recargo se calcula sobre lo que se paga con tarjeta.'}
      </small>
    </fieldset>
  ) : null;

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

  const payerPhone = student?.phone ?? (walkIn?.phone.trim() || null);

  const submitLabel =
    tab === 'debt'
      ? saving
        ? 'Cargando…'
        : 'Cargar deuda'
      : saving
        ? 'Cobrando…'
        : `Cobrar ${money(centsToDecimal(totalCents))}`;

  const content = (
    <>
      <header className="collect-header">
        <h2 id="collect-title">{inline ? 'Registrar cobro' : 'Registrar pago'}</h2>
        {!inline && (
          <button type="button" className="secondary" disabled={saving} onClick={close}>
            Cerrar
          </button>
        )}
      </header>

      {!student && !walkIn ? (
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
          <button type="button" className="link-button collect-walk-in" onClick={startWalkIn}>
            No es alumno: cobrar una clase suelta a un alumno eventual
          </button>
        </div>
      ) : done ? (
        <div className="collect-done" role="status">
          <span className="collect-done-icon" aria-hidden="true">
            <Check size={28} />
          </span>
          <h3>Cobro registrado</h3>
          <p className="collect-done-amount">{paymentSummary(done).amount}</p>
          {doneSurcharge && (
            <p className="modal-copy">Más {money(doneSurcharge)} de recargo por tarjeta</p>
          )}
          <p className="modal-copy">
            {payerName(done)} · {paymentSummary(done).methods}
          </p>
          <p className="modal-copy">{paymentSummary(done).detail}</p>
          {student && charges && (
            <p className="collect-done-balance">
              {debtCents > 0n ? `Le queda por pagar ${money(debt)}.` : 'Queda al día.'}
            </p>
          )}
          <a
            className="button collect-done-whatsapp"
            href={whatsappReceiptUrl(
              done,
              payerPhone,
              done.kind === 'CHARGES' && charges ? debt : null,
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Enviar recibo por WhatsApp
          </a>
          {!whatsappNumber(payerPhone) && (
            <p className="collect-hint">
              {payerPhone
                ? `El teléfono cargado (${payerPhone}) no parece un celular: WhatsApp te va a pedir el contacto.`
                : 'No hay teléfono cargado: WhatsApp te va a pedir el contacto.'}
            </p>
          )}
          {inline ? (
            <div className="modal-actions collect-done-actions">
              <button type="button" className="secondary" onClick={anotherForSameStudent}>
                Listo
              </button>
            </div>
          ) : (
            <div className="modal-actions collect-done-actions">
              <button type="button" className="secondary" onClick={() => onClose(true)}>
                Terminar
              </button>
              <button type="button" className="secondary" onClick={backToSearch}>
                Cobrar a otro alumno
              </button>
              {student && (
                <button type="button" onClick={anotherForSameStudent}>
                  Cobrar otra cosa a {student.firstName}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <form className="collect-form" onSubmit={(event) => void submit(event)} noValidate>
          {walkIn && (
            <>
              <div className="collect-student">
                <div>
                  <strong>Alumno eventual</strong>
                  <span>Sin ficha ni cuotas: se registra solo esta clase suelta.</span>
                </div>
                <div className="collect-student-links">
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
              <div className="collect-walk-in-fields">
                <label className="wide">
                  Nombre y apellido
                  <input
                    maxLength={160}
                    value={walkIn.name}
                    disabled={saving}
                    aria-invalid={tried && walkIn.name.trim().length < 2}
                    onChange={(event) => setWalkIn({ ...walkIn, name: event.target.value })}
                  />
                </label>
                <label>
                  Teléfono (opcional)
                  <input
                    inputMode="tel"
                    maxLength={80}
                    value={walkIn.phone}
                    disabled={saving}
                    onChange={(event) => setWalkIn({ ...walkIn, phone: event.target.value })}
                  />
                </label>
                <label>
                  DNI (opcional)
                  <input
                    inputMode="numeric"
                    maxLength={32}
                    value={walkIn.dni}
                    disabled={saving}
                    onChange={(event) => setWalkIn({ ...walkIn, dni: event.target.value })}
                  />
                </label>
              </div>
            </>
          )}
          {!inline && student && (
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
                  {Number(credit) > 0 ? ` · a favor ${money(credit)}` : ''}
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
          )}

          {!walkInMode && (
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
          )}

          {notice && (
            <p className="collect-notice" role="status">
              {notice}
            </p>
          )}

          {tab === 'charges' && (
            <div className="collect-panel" role="tabpanel">
              {charges !== null && Number(credit) > 0 && (
                <div className="collect-credit-note" role="status">
                  <span>
                    Tiene <strong>{money(credit)}</strong> de saldo a favor.
                    {!can('payments:collect')
                      ? ''
                      : pending.length === 0
                        ? ' Generá la cuota que paga y después usalo.'
                        : ' Se usa en las cuotas pendientes, de la más vieja a la más nueva, sin pasar por la caja.'}
                  </span>
                  {can('payments:collect') && pending.length > 0 && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={saving || applyingCredit}
                      onClick={() => void applyCredit()}
                    >
                      {applyingCredit ? 'Aplicando…' : 'Usar saldo a favor'}
                    </button>
                  )}
                </div>
              )}
              {charges === null ? (
                <p className="modal-copy">Cargando cuotas…</p>
              ) : pending.length === 0 ? (
                <p className="collect-empty">
                  Está al día: no tiene cuotas pendientes. Si viene a pagar un mes, generá la cuota.
                </p>
              ) : (
                <>
                  {canChoose && (
                    <p className="collect-hint">
                      {chosenOpen.length > 0
                        ? 'Se cobran solo las cuotas marcadas.'
                        : 'Se cobra desde la cuota más vieja. Si paga otro mes, marcá sus cuotas.'}
                    </p>
                  )}
                  <ul className="collect-charges">
                    {pending.map((charge) => {
                      const applied = preview.find((item) => item.charge.id === charge.id);
                      return (
                        <li key={charge.id} className={applied ? 'is-applied' : ''}>
                          {canChoose && (
                            <input
                              type="checkbox"
                              className="collect-charge-pick"
                              aria-label={`Cobrar ${chargeLabel(charge)}`}
                              checked={chosen.includes(charge.id)}
                              disabled={saving}
                              onChange={() => toggleChosen(charge.id)}
                            />
                          )}
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
                            {((can('charges:generate') && charge.kind === 'MONTHLY') ||
                              chargeActions) && (
                              <span className="collect-charge-actions">
                                {can('charges:generate') && charge.kind === 'MONTHLY' && (
                                  <button
                                    type="button"
                                    className="link-button"
                                    disabled={saving}
                                    onClick={() => setDueDateTarget(charge)}
                                  >
                                    Cambiar vencimiento
                                  </button>
                                )}
                                {chargeActions?.(charge)}
                              </span>
                            )}
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
                </>
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
                  {excessCents > 0n && (
                    <label className="collect-credit">
                      <input
                        type="checkbox"
                        checked={keepCredit}
                        disabled={saving}
                        onChange={(event) => setKeepCredit(event.target.checked)}
                      />
                      Paga {money(centsToDecimal(excessCents))} de más: dejarlo como saldo a favor
                      <small className="collect-hint">
                        No se aplica solo: queda para otro cobro del alumno o para devolver.
                      </small>
                    </label>
                  )}
                  {tenderFields}
                  {cardTypeFields}
                </>
              )}
            </div>
          )}

          {tab === 'other' && (
            <div className="collect-panel" role="tabpanel">
              {!walkInMode && (
                <fieldset className="collect-concepts" disabled={saving}>
                  <legend className="sr-only">¿A qué corresponde?</legend>
                  {options.map((option) => (
                    <label
                      key={option.key}
                      className={selectedOption?.key === option.key ? 'is-selected' : ''}
                    >
                      <input
                        type="radio"
                        name="collect-concept"
                        checked={selectedOption?.key === option.key}
                        onChange={() => {
                          setConcept(option.concept);
                          setConceptId(option.conceptId);
                        }}
                      />
                      {option.label}
                    </label>
                  ))}
                  {catalog === null && <span className="collect-hint">Cargando conceptos…</span>}
                </fieldset>
              )}
              {concept === 'SINGLE_CLASS' && (
                <label>
                  Clase
                  <select
                    value={classId}
                    disabled={saving || classes === null}
                    aria-invalid={tried && !classId}
                    onChange={(event) => {
                      const next = classes?.find((item) => item.id === event.target.value);
                      setClassId(event.target.value);
                      // El profesor de la clase por defecto; si la dio un reemplazo, se cambia.
                      setTeacherId(next?.teacher.id ?? '');
                    }}
                  >
                    <option value="">
                      {classes === null ? 'Cargando clases…' : 'Elegí la clase'}
                    </option>
                    {classes?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · Prof. {classTeachersLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {concept === 'SINGLE_CLASS' && selectedClass && (
                <label>
                  Profesor que la dictó
                  <select
                    value={teacherId}
                    disabled={saving}
                    onChange={(event) => setTeacherId(event.target.value)}
                  >
                    {!teachers?.some((item) => item.id === selectedClass.teacher.id) && (
                      <option value={selectedClass.teacher.id}>
                        {selectedClass.teacher.firstName} {selectedClass.teacher.lastName}
                      </option>
                    )}
                    {teachers?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.firstName} {item.lastName}
                        {item.id === selectedClass.teacher.id ||
                        selectedClass.additionalTeachers.some(({ id }) => id === item.id)
                          ? ' (profesor de la clase)'
                          : ''}
                      </option>
                    ))}
                  </select>
                  <small className="collect-hint">
                    El cobro queda a nombre de este profesor en ingresos y liquidaciones.
                  </small>
                </label>
              )}
              <label>
                {otherForm.requiresDetail ? 'Detalle' : 'Detalle (opcional)'}
                <input
                  maxLength={200}
                  value={detail}
                  disabled={saving}
                  placeholder={
                    otherForm.requiresDetail
                      ? 'Ej.: seña de un taller, inscripción a un evento'
                      : ''
                  }
                  aria-invalid={tried && otherForm.requiresDetail && detail.trim().length < 3}
                  onChange={(event) => setDetail(event.target.value)}
                />
              </label>
              {canUseCredit && (
                <label className="collect-surcharge">
                  Usar saldo a favor (tiene {money(credit)})
                  <input
                    inputMode="decimal"
                    placeholder="0,00"
                    value={creditUse}
                    disabled={saving}
                    aria-invalid={tried && creditUseCents === null}
                    onChange={(event) => setCreditUse(event.target.value)}
                  />
                  <small className="collect-hint">
                    Se descuenta de su saldo sin pasar por la caja. El resto se cobra abajo.
                  </small>
                </label>
              )}
              {amountField(creditUseCents ? 'Importe en otros medios' : 'Importe')}
              {tenderFields}
              {cardTypeFields}
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

          {tab !== 'debt' &&
            can('payments:void') &&
            !(tab === 'charges' && pending.length === 0) && (
              <label className="collect-paid-date">
                Fecha del pago
                <input
                  type="date"
                  max={today}
                  value={paidDate}
                  disabled={saving}
                  onChange={(event) => setPaidDate(event.target.value)}
                />
                <small className="collect-hint">
                  Cambiala solo si el pago se cobró otro día y se carga tarde.
                </small>
              </label>
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
            markChanged();
            setAmountTouched(false);
            setNotice(`${result.title}. Ya podés cobrarla.`);
            void loadCharges(student.id).catch(() => undefined);
          }}
        />
      )}
      {dueDateTarget && (
        <ChargeDueDateModal
          charge={dueDateTarget}
          onClose={() => setDueDateTarget(null)}
          onSaved={() => {
            setDueDateTarget(null);
            markChanged();
            setNotice('Vencimiento actualizado.');
            if (student) void loadCharges(student.id).catch(() => undefined);
          }}
        />
      )}
    </>
  );

  return inline ? (
    <section id="registrar-cobro" className="card collect-inline" aria-labelledby="collect-title">
      {content}
    </section>
  ) : (
    <dialog
      ref={dialog}
      className="modal card collect-dialog"
      aria-labelledby="collect-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!generating && !dueDateTarget) close();
      }}
    >
      {content}
    </dialog>
  );
}
