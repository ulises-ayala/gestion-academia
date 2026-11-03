import type { MonthlyChargeDto, PaymentDto, ReallocatePaymentDto } from '@academy/contracts';
import { normalizeAmount } from './collect-payment';
import { centsToDecimal, decimalToCents } from './payments';

export type ReallocationRow = Readonly<{
  charge: MonthlyChargeDto;
  /** Lo que este pago tiene imputado hoy en la cuota. */
  currentCents: bigint;
  /** Lo máximo que puede quedar imputado: lo que debe más lo que ya tiene de este pago. */
  maxCents: bigint;
}>;

const cents = (value: string) => decimalToCents(value) ?? 0n;

/** Cuotas a las que se puede pasar el pago: las que ya tiene y las que tienen saldo. */
export const reallocationRows = (
  payment: PaymentDto,
  charges: readonly MonthlyChargeDto[],
): readonly ReallocationRow[] =>
  charges
    .filter((charge) => charge.status !== 'VOID')
    .map((charge) => {
      const currentCents = payment.allocations
        .filter((allocation) => allocation.monthlyChargeId === charge.id)
        .reduce((sum, allocation) => sum + cents(allocation.amount), 0n);
      return { charge, currentCents, maxCents: cents(charge.outstandingAmount) + currentCents };
    })
    .filter((row) => row.maxCents > 0n)
    .sort(
      (left, right) =>
        left.charge.dueDate.localeCompare(right.charge.dueDate) ||
        left.charge.createdAt.localeCompare(right.charge.createdAt),
    );

/** El formulario arranca con la imputación actual (importe por cuota). */
export const reallocationFormFrom = (rows: readonly ReallocationRow[]) =>
  Object.fromEntries(
    rows.map((row) => [
      row.charge.id,
      row.currentCents > 0n ? centsToDecimal(row.currentCents).replace(/\.00$/, '') : '',
    ]),
  ) as Readonly<Record<string, string>>;

const parsed = (form: Readonly<Record<string, string>>) =>
  Object.entries(form).map(([monthlyChargeId, value]) => ({
    monthlyChargeId,
    cents: value.trim() ? decimalToCents(normalizeAmount(value)) : 0n,
  }));

export const reallocationTotalCents = (form: Readonly<Record<string, string>>) =>
  parsed(form).reduce((sum, row) => sum + (row.cents ?? 0n), 0n);

/** Lo que el pago puede imputar: su importe menos lo ya devuelto del saldo a favor. */
const allocatableCents = (payment: Pick<PaymentDto, 'amount' | 'refundedAmount'>) =>
  cents(payment.amount) - cents(payment.refundedAmount);

/** Lo que queda como saldo a favor con la imputación del formulario (nunca negativo). */
export const reallocationCreditCents = (
  payment: Pick<PaymentDto, 'amount' | 'refundedAmount'>,
  form: Readonly<Record<string, string>>,
) => {
  const credit = allocatableCents(payment) - reallocationTotalCents(form);
  return credit > 0n ? credit : 0n;
};

/** Primer motivo por el que no se puede reimputar, o null. */
export const reallocationProblem = (
  payment: PaymentDto,
  rows: readonly ReallocationRow[],
  form: Readonly<Record<string, string>>,
  reason: string,
) => {
  const values = parsed(form);
  if (values.some((row) => row.cents === null))
    return 'Usá importes positivos con hasta dos decimales.';
  for (const row of rows) {
    const value = values.find((item) => item.monthlyChargeId === row.charge.id)?.cents ?? 0n;
    if (value > row.maxCents)
      return `A esa cuota le podés aplicar hasta ${centsToDecimal(row.maxCents)}.`;
  }
  const total = reallocationTotalCents(form);
  const allocatable = allocatableCents(payment);
  if (total > allocatable)
    return `Las cuotas no pueden sumar más de ${centsToDecimal(allocatable)} (hoy suman ${centsToDecimal(total)}).`;
  if (
    rows.every(
      (row) =>
        (values.find((item) => item.monthlyChargeId === row.charge.id)?.cents ?? 0n) ===
        row.currentCents,
    )
  )
    return 'No cambiaste ninguna cuota.';
  if (reason.trim().length < 3) return 'Contá el motivo del cambio.';
  return null;
};

export const reallocationPayload = (
  form: Readonly<Record<string, string>>,
  reason: string,
): ReallocatePaymentDto => ({
  reason: reason.trim(),
  allocations: parsed(form)
    .filter((row) => (row.cents ?? 0n) > 0n)
    .map((row) => ({ monthlyChargeId: row.monthlyChargeId, amount: centsToDecimal(row.cents!) })),
});
