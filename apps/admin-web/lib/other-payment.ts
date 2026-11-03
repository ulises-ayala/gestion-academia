import type {
  CreateOtherPaymentDto,
  OtherPaymentConceptDto,
  PaymentConceptDto,
  PaymentDto,
} from '@academy/contracts';
import { createPaymentPayload, tenderTotal, type TenderAmounts } from './payments';

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

/** Primer motivo por el que no se puede registrar el cobro, o null si está completo. */
export const otherPaymentProblem = (form: OtherPaymentForm, tenders: TenderAmounts) => {
  if (form.concept === 'SINGLE_CLASS' && !form.classId) return 'Elegí la clase.';
  if (form.concept === 'OTHER' && !form.conceptId) return 'Elegí a qué corresponde el cobro.';
  if (form.requiresDetail && form.detail.trim().length < 3) return 'Contá brevemente qué se cobra.';
  if (tenderTotal(tenders) <= 0n) return 'Ingresá el importe recibido.';
  return null;
};

export const buildOtherPaymentPayload = (
  studentId: string,
  form: OtherPaymentForm,
  tenders: TenderAmounts,
): CreateOtherPaymentDto => ({
  ...createPaymentPayload(studentId, tenders),
  concept: form.concept,
  ...(form.concept === 'OTHER' && form.conceptId ? { conceptId: form.conceptId } : {}),
  classId: form.concept === 'SINGLE_CLASS' ? form.classId : null,
  teacherId: form.concept === 'SINGLE_CLASS' && form.teacherId ? form.teacherId : null,
  detail: form.detail.trim() || null,
});

/** Alumno eventual de una clase suelta: nombre obligatorio, teléfono y DNI opcionales. */
export type WalkInForm = Readonly<{ name: string; phone: string; dni: string }>;

export const walkInProblem = (form: WalkInForm) => {
  if (form.name.trim().length < 2) return 'Escribí el nombre del alumno eventual.';
  const dni = form.dni.replace(/\D/g, '');
  if (
    form.dni.trim() &&
    (!/^[\d.\-\s]+$/.test(form.dni.trim()) || dni.length < 6 || dni.length > 9)
  )
    return 'El DNI debe tener entre 6 y 9 dígitos.';
  return null;
};

/** Clase suelta cobrada a un alumno eventual: sin alumno, con su nombre y datos opcionales. */
export const buildWalkInPaymentPayload = (
  walkIn: WalkInForm,
  form: OtherPaymentForm,
  tenders: TenderAmounts,
): CreateOtherPaymentDto => ({
  walkIn: {
    name: walkIn.name.trim(),
    phone: walkIn.phone.trim() || null,
    dni: walkIn.dni.trim() || null,
  },
  tenders: createPaymentPayload('', tenders).tenders,
  concept: 'SINGLE_CLASS',
  classId: form.classId,
  teacherId: form.teacherId || null,
  detail: form.detail.trim() || null,
});
