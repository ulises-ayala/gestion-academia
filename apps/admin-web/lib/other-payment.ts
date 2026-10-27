import type { CreateOtherPaymentDto, OtherPaymentConceptDto, PaymentDto } from '@academy/contracts';
import { createPaymentPayload, tenderTotal, type TenderAmounts } from './payments';

export const otherConceptLabels: Readonly<Record<OtherPaymentConceptDto, string>> = {
  SINGLE_CLASS: 'Clase suelta',
  OTHER: 'Otro',
};

export type OtherPaymentForm = Readonly<{
  concept: OtherPaymentConceptDto;
  classId: string;
  detail: string;
}>;

/** Texto de "a qué corresponde" un cobro que no es de cuotas. */
export const describeOtherPayment = (other: PaymentDto['otherConcept']) => {
  if (!other) return '';
  if (other.concept === 'SINGLE_CLASS')
    return `Clase suelta${other.academicClass ? ` · ${other.academicClass.name}` : ''}${
      other.detail ? ` (${other.detail})` : ''
    }`;
  return `Otro: ${other.detail ?? ''}`.trim();
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
  detail: form.detail.trim() || null,
});
