import type {
  CreateOtherPaymentDto,
  OtherPaymentConceptDto,
  PaymentConceptDto,
  PaymentDto,
} from '@academy/contracts';
import { centsToDecimal, createPaymentPayload, tenderTotal, type TenderAmounts } from './payments';

/** Nombres de los otros cobros que no vienen del catálogo de conceptos. */
export const otherConceptLabels: Readonly<Record<OtherPaymentConceptDto, string>> = {
  SINGLE_CLASS: 'Clase suelta',
  CARD_SURCHARGE: 'Recargo por tarjeta',
  OTHER: 'Otro',
};

/** Opción para elegir a qué corresponde un otro cobro: clase suelta, catálogo o recargo. */
export type ConceptOption = Readonly<{
  key: string;
  label: string;
  concept: OtherPaymentConceptDto;
  conceptId: string | null;
  requiresDetail: boolean;
}>;

/** Clase suelta primero, después los conceptos activos del catálogo y al final el recargo. */
export const conceptOptions = (catalog: readonly PaymentConceptDto[]): readonly ConceptOption[] => [
  {
    key: 'SINGLE_CLASS',
    label: otherConceptLabels.SINGLE_CLASS,
    concept: 'SINGLE_CLASS',
    conceptId: null,
    requiresDetail: false,
  },
  ...catalog
    .filter((item) => item.status === 'ACTIVE')
    .map((item) => ({
      key: item.id,
      label: item.name,
      concept: 'OTHER' as const,
      conceptId: item.id,
      requiresDetail: item.requiresDetail,
    })),
  {
    key: 'CARD_SURCHARGE',
    label: otherConceptLabels.CARD_SURCHARGE,
    concept: 'CARD_SURCHARGE',
    conceptId: null,
    requiresDetail: false,
  },
];

export type OtherPaymentForm = Readonly<{
  concept: OtherPaymentConceptDto;
  /** Concepto del catálogo (con `concept = OTHER`). */
  conceptId?: string | null;
  /** El concepto elegido pide contar qué se cobró. */
  requiresDetail?: boolean;
  classId: string;
  /** Profesor que dictó la clase suelta; vacío = el de la clase. */
  teacherId?: string;
  detail: string;
}>;

/** Texto de "a qué corresponde" un cobro que no es de cuotas. */
export const describeOtherPayment = (other: PaymentDto['otherConcept']) => {
  if (!other) return '';
  if (other.concept === 'SINGLE_CLASS')
    return `Clase suelta${other.academicClass ? ` · ${other.academicClass.name}` : ''}${
      other.teacher ? ` · Prof. ${other.teacher.firstName} ${other.teacher.lastName}` : ''
    }${other.detail ? ` (${other.detail})` : ''}`;
  const name =
    other.concept === 'OTHER'
      ? (other.catalogConcept?.name ?? otherConceptLabels.OTHER)
      : otherConceptLabels[other.concept];
  return `${name}${other.detail ? ` (${other.detail})` : ''}`;
};

/**
 * Primer motivo por el que no se puede registrar el cobro, o null si está completo. `credit`: saldo
 * a favor que se usa (en centavos) y el disponible del alumno.
 */
export const otherPaymentProblem = (
  form: OtherPaymentForm,
  tenders: TenderAmounts,
  credit: Readonly<{ usedCents: bigint | null; availableCents: bigint }> = {
    usedCents: 0n,
    availableCents: 0n,
  },
) => {
  if (form.concept === 'SINGLE_CLASS' && !form.classId) return 'Elegí la clase.';
  if (form.concept === 'OTHER' && !form.conceptId) return 'Elegí a qué corresponde el cobro.';
  if (form.requiresDetail && form.detail.trim().length < 3) return 'Contá brevemente qué se cobra.';
  if (credit.usedCents === null) return 'El saldo a usar tiene que ser un importe válido.';
  if (credit.usedCents > credit.availableCents)
    return `Tiene ${centsToDecimal(credit.availableCents)} de saldo a favor.`;
  if (tenderTotal(tenders) <= 0n && credit.usedCents <= 0n) return 'Ingresá el importe recibido.';
  return null;
};

/** creditCents: parte que se paga con saldo a favor (no pasa por la caja). */
export const buildOtherPaymentPayload = (
  studentId: string,
  form: OtherPaymentForm,
  tenders: TenderAmounts,
  creditCents = 0n,
): CreateOtherPaymentDto => ({
  ...createPaymentPayload(studentId, tenders),
  ...(creditCents > 0n ? { creditAmount: centsToDecimal(creditCents) } : {}),
  concept: form.concept,
  ...(form.concept === 'OTHER' && form.conceptId ? { conceptId: form.conceptId } : {}),
  classId: form.concept === 'SINGLE_CLASS' ? form.classId : null,
  teacherId: form.concept === 'SINGLE_CLASS' && form.teacherId ? form.teacherId : null,
  detail: form.detail.trim() || null,
});

/** Nombre con que queda una venta a quien no es alumno cuando no se carga el comprador. */
export const PUBLIC_BUYER_NAME = 'Público general';

/**
 * Quien paga sin ser alumno: el alumno eventual de una clase suelta (nombre obligatorio) o el
 * comprador de una venta (nombre opcional). Teléfono y DNI siempre opcionales.
 */
export type WalkInForm = Readonly<{ name: string; phone: string; dni: string }>;

/** A quien no es alumno se le cobra una clase suelta o un concepto del catálogo, no un recargo. */
export const walkInConceptOptions = (options: readonly ConceptOption[]) =>
  options.filter((option) => option.concept !== 'CARD_SURCHARGE');

export const walkInProblem = (form: WalkInForm, nameRequired = true) => {
  const name = form.name.trim();
  if (nameRequired && name.length < 2) return 'Escribí el nombre del alumno eventual.';
  if (name.length === 1) return 'El nombre es demasiado corto.';
  const dni = form.dni.replace(/\D/g, '');
  if (
    form.dni.trim() &&
    (!/^[\d.\-\s]+$/.test(form.dni.trim()) || dni.length < 6 || dni.length > 9)
  )
    return 'El DNI debe tener entre 6 y 9 dígitos.';
  return null;
};

/**
 * Cobro a quien no es alumno: una clase suelta (alumno eventual) o una venta del catálogo. Sin
 * alumno, con sus datos; una venta sin nombre queda como "Público general".
 */
export const buildWalkInPaymentPayload = (
  walkIn: WalkInForm,
  form: OtherPaymentForm,
  tenders: TenderAmounts,
): CreateOtherPaymentDto => ({
  walkIn: {
    name: walkIn.name.trim() || null,
    phone: walkIn.phone.trim() || null,
    dni: walkIn.dni.trim() || null,
  },
  tenders: createPaymentPayload('', tenders).tenders,
  concept: form.concept,
  ...(form.concept === 'OTHER' && form.conceptId ? { conceptId: form.conceptId } : {}),
  classId: form.concept === 'SINGLE_CLASS' ? form.classId : null,
  teacherId: form.concept === 'SINGLE_CLASS' && form.teacherId ? form.teacherId : null,
  detail: form.detail.trim() || null,
});
