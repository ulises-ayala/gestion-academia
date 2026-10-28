import type {
  CreateHistoricalDebtDto,
  MonthlyChargeDto,
  MonthlyChargeKindDto,
  PaymentDto,
  PaymentMethodDto,
} from '@academy/contracts';
import { periodLabel } from './charge-generation';
import { describeOtherPayment } from './other-payment';
import {
  centsToDecimal,
  decimalToCents,
  paymentMethodLabels,
  type TenderAmounts,
} from './payments';

export type CollectTab = 'charges' | 'other' | 'debt';
export type TenderMode = PaymentMethodDto | 'MIXED';
export type TenderPick = Readonly<{ mode: TenderMode; amount: string; split: TenderAmounts }>;

export const emptyTenders: TenderAmounts = { CASH: '', MERCADO_PAGO: '', CARD: '' };
export const tenderModes: readonly TenderMode[] = ['CASH', 'MERCADO_PAGO', 'CARD', 'MIXED'];
export const tenderModeLabels: Readonly<Record<TenderMode, string>> = {
  ...paymentMethodLabels,
  MIXED: 'Mixto',
};

/**
 * Acepta el importe como lo escribe la recepción: "210.000", "210000", "1.500,50" o "1500.5".
 * El punto con grupos de tres dígitos es separador de miles; la coma, decimal.
 */
export const normalizeAmount = (value: string) => {
  const text = value.replace(/[\s$]/g, '');
  if (text.includes(',')) return text.replace(/\./g, '').replace(',', '.');
  if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) return text.replace(/\./g, '');
  return text;
};

/** Importe para precargar el campo, como se escribe acá: "41.000" o "41.000,50". */
export const amountInputValue = (cents: bigint) => {
  if (cents <= 0n) return '';
  const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimals = cents % 100n;
  return decimals === 0n ? whole : `${whole},${decimals.toString().padStart(2, '0')}`;
};

/** Nombre de lo que se cobra: el mes de la cuota o el detalle de la deuda anterior. */
export const chargeLabel = (
  charge: Readonly<{ kind: MonthlyChargeKindDto; description: string | null; period: string }>,
) =>
  charge.kind === 'HISTORICAL_DEBT'
    ? `Deuda anterior${charge.description ? `: ${charge.description}` : ''}`
    : periodLabel(charge.period);

/** Con un solo medio, el importe va todo a ese medio; con "Mixto", cada medio lleva el suyo. */
export const tendersFrom = (pick: TenderPick): TenderAmounts => {
  const raw = pick.mode === 'MIXED' ? pick.split : { ...emptyTenders, [pick.mode]: pick.amount };
  return {
    CASH: normalizeAmount(raw.CASH),
    MERCADO_PAGO: normalizeAmount(raw.MERCADO_PAGO),
    CARD: normalizeAmount(raw.CARD),
  };
};

export const pickTotalCents = (pick: TenderPick) =>
  (Object.values(tendersFrom(pick)) as string[]).reduce(
    (sum, value) => sum + (value.trim() ? (decimalToCents(value) ?? 0n) : 0n),
    0n,
  );

export const pickIsInvalid = (pick: TenderPick) =>
  (Object.values(tendersFrom(pick)) as string[]).some(
    (value) => value.trim() !== '' && decimalToCents(value) === null,
  );

/** Primer motivo por el que no se puede cobrar cuotas, o null. */
export const chargesProblem = (pick: TenderPick, debtCents: bigint) => {
  if (debtCents <= 0n) return 'No tiene cuotas pendientes: generá la cuota que viene a pagar.';
  if (pickIsInvalid(pick)) return 'Usá importes positivos con hasta dos decimales.';
  const total = pickTotalCents(pick);
  if (total <= 0n) return 'Ingresá el importe recibido.';
  if (total > debtCents)
    return `El importe supera la deuda (${money(centsToDecimal(debtCents))}). Si paga meses adelantados, generá primero esas cuotas.`;
  return null;
};

export const historicalDebtProblem = (
  form: Readonly<{ enrollmentId: string; amount: string; description: string }>,
) => {
  if (!form.enrollmentId) return 'Elegí la clase a la que corresponde la deuda.';
  const cents = form.amount.trim() ? decimalToCents(normalizeAmount(form.amount)) : null;
  if (cents === null || cents <= 0n) return 'Ingresá el monto de la deuda.';
  if (form.description.trim().length < 3)
    return 'Contá a qué corresponde (por ejemplo, "Deuda ControlFit").';
  return null;
};

export const historicalDebtPayload = (
  form: Readonly<{ enrollmentId: string; amount: string; description: string }>,
): CreateHistoricalDebtDto => ({
  enrollmentId: form.enrollmentId,
  amount: centsToDecimal(decimalToCents(normalizeAmount(form.amount)) ?? 0n),
  description: form.description.trim(),
});

export const money = (value: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));

/** Resumen del cobro hecho, para el comprobante del popup. */
export const paymentSummary = (payment: PaymentDto) => {
  const methods = payment.tenders
    .map((tender) =>
      payment.tenders.length > 1
        ? `${paymentMethodLabels[tender.method]} ${money(tender.amount)}`
        : paymentMethodLabels[tender.method],
    )
    .join(' + ');
  const detail =
    payment.kind === 'OTHER'
      ? describeOtherPayment(payment.otherConcept)
      : payment.allocations
          .map((allocation) => `${chargeLabel(allocation)} ${money(allocation.amount)}`)
          .join(' · ');
  return { amount: money(payment.amount), methods, detail };
};

/** Cuotas abiertas que suman la deuda (las mismas que imputa el cobro, de la más vieja). */
export const isOpenCharge = (charge: MonthlyChargeDto) =>
  (charge.status === 'PENDING' || charge.status === 'PARTIAL') &&
  (decimalToCents(charge.outstandingAmount) ?? 0n) > 0n;
