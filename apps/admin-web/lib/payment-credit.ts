import type { PaymentDto, PaymentMethodDto, RefundPaymentDto } from '@academy/contracts';
import { normalizeAmount } from './collect-payment';
import { centsToDecimal, decimalToCents } from './payments';

/** Saldo a favor del pago, en centavos (lo cobrado que no está imputado ni devuelto). */
export const creditCents = (payment: Pick<PaymentDto, 'creditAmount'>) =>
  decimalToCents(payment.creditAmount) ?? 0n;

export const hasCredit = (payment: Pick<PaymentDto, 'creditAmount' | 'status'>) =>
  payment.status === 'CONFIRMED' && creditCents(payment) > 0n;

/** Primer motivo por el que no se puede devolver, o null. */
export const refundProblem = (
  payment: Pick<PaymentDto, 'creditAmount'>,
  amount: string,
  reason: string,
) => {
  const cents = decimalToCents(normalizeAmount(amount) || 'x');
  if (!cents || cents <= 0n) return 'Ingresá cuánto se devuelve.';
  if (cents > creditCents(payment))
    return `Se puede devolver hasta ${centsToDecimal(creditCents(payment))}.`;
  if (reason.trim().length < 3) return 'Contá por qué se devuelve.';
  return null;
};

export const refundPayload = (
  amount: string,
  method: PaymentMethodDto,
  reason: string,
): RefundPaymentDto => ({
  amount: centsToDecimal(decimalToCents(normalizeAmount(amount)) ?? 0n),
  method,
  reason: reason.trim(),
});
