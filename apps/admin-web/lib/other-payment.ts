import type { CreateOtherPaymentDto, OtherPaymentConceptDto, PaymentDto } from '@academy/contracts';
import { createPaymentPayload, tenderTotal, type TenderAmounts } from './payments';

export const otherConceptLabels: Readonly<Record<OtherPaymentConceptDto, string>> = {
  SINGLE_CLASS: 'Clase suelta',
  APPAREL: 'Indumentaria',
  GALA_SEAL: 'Precintos de la Gala',
  CARD_SURCHARGE: 'Recargo por tarjeta',
  OTHER: 'Otro',
};

export type OtherPaymentForm = Readonly<{
  concept: OtherPaymentConceptDto;
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
  if (other.concept === 'OTHER') return `Otro: ${other.detail ?? ''}`.trim();
  return `${otherConceptLabels[other.concept]}${other.detail ? ` (${other.detail})` : ''}`;
};

/** Primer motivo por el que no se puede registrar el cobro, o null si está completo. */
export const otherPaymentProblem = (form: OtherPaymentForm, tenders: TenderAmounts) => {
  if (form.concept === 'SINGLE_CLASS' && !form.classId) return 'Elegí la clase.';
  if (form.concept === 'OTHER' && form.detail.trim().length < 3)
    return 'Contá brevemente qué se cobra.';
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
