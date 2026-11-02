import type { CorrectPaymentDto, PaymentDto, PaymentMethodDto } from '@academy/contracts';
import { normalizeAmount } from './collect-payment';
import { centsToDecimal, decimalToCents, type TenderAmounts } from './payments';

export type PaymentCorrectionForm = Readonly<{
  tenders: TenderAmounts;
  paidDate: string;
  reason: string;
}>;

/** Fecha (AAAA-MM-DD) del pago en Argentina. */
export const businessDate = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Buenos_Aires' }).format(new Date(iso));

/** El formulario arranca con los medios y la fecha del pago tal como están. */
export const correctionFormFrom = (payment: PaymentDto): PaymentCorrectionForm => ({
  tenders: {
    CASH: '',
    MERCADO_PAGO: '',
    TRANSFER: '',
    CARD: '',
    ...Object.fromEntries(
      payment.tenders.map((tender) => [tender.method, tender.amount.replace(/\.00$/, '')]),
    ),
  },
  paidDate: businessDate(payment.paidAt),
  reason: '',
});

const tenderList = (tenders: TenderAmounts) =>
  (Object.entries(tenders) as [PaymentMethodDto, string][])
    .map(([method, amount]) => ({
      method,
      cents: amount.trim() ? decimalToCents(normalizeAmount(amount)) : 0n,
    }))
    .filter((tender) => tender.cents !== 0n);

export const correctionTotalCents = (form: PaymentCorrectionForm) =>
  tenderList(form.tenders).reduce((sum, tender) => sum + (tender.cents ?? 0n), 0n);

const sameTenders = (payment: PaymentDto, form: PaymentCorrectionForm) => {
  const key = (items: { method: string; cents: bigint | null }[]) =>
    items
      .map((item) => `${item.method}:${item.cents}`)
      .sort()
      .join('|');
  return (
    key(payment.tenders.map((t) => ({ method: t.method, cents: decimalToCents(t.amount) }))) ===
    key(tenderList(form.tenders))
  );
};

/** Primer motivo por el que no se puede corregir, o null. */
export const correctionProblem = (
  payment: PaymentDto,
  form: PaymentCorrectionForm,
  today: string,
) => {
  if (tenderList(form.tenders).some((tender) => tender.cents === null))
    return 'Usá importes positivos con hasta dos decimales.';
  if (correctionTotalCents(form) <= 0n) return 'Ingresá al menos un medio con importe.';
  if (!form.paidDate) return 'Indicá la fecha del pago.';
  if (form.paidDate > today) return 'La fecha del pago no puede ser futura.';
  if (sameTenders(payment, form) && form.paidDate === businessDate(payment.paidAt))
    return 'No cambiaste nada del pago.';
  if (form.reason.trim().length < 3) return 'Contá el motivo de la corrección.';
  return null;
};

export const correctionPayload = (
  payment: PaymentDto,
  form: PaymentCorrectionForm,
): CorrectPaymentDto => ({
  reason: form.reason.trim(),
  tenders: tenderList(form.tenders).map((tender) => ({
    method: tender.method,
    amount: centsToDecimal(tender.cents ?? 0n),
  })),
  ...(form.paidDate !== businessDate(payment.paidAt) ? { paidDate: form.paidDate } : {}),
});
