import { Prisma } from '@academy/database';
import { DomainError } from '../../shared/domain/domain-error';
import { buildPaymentAllocationPlan, type ChargeForPaymentAllocation } from './payment-allocation';

type Amount = Readonly<{ amount: Prisma.Decimal }>;
const sum = (rows: readonly Amount[]) =>
  rows.reduce((total, row) => total.plus(row.amount), new Prisma.Decimal(0));

/**
 * Saldo a favor de un pago de cuotas: lo que no está imputado a ninguna cuota (se cobró de más o
 * se desimputó) menos lo ya devuelto o usado en otros cobros (`refunds` recibe ambos). Nunca se
 * aplica solo.
 */
export const paymentCredit = (
  amount: Prisma.Decimal,
  allocations: readonly Amount[],
  refunds: readonly Amount[],
) => Prisma.Decimal.max(amount.minus(sum(allocations)).minus(sum(refunds)), 0);

/** Lo que un pago puede imputar a cuotas: su importe menos lo devuelto. */
export const allocatableAmount = (amount: Prisma.Decimal, refunds: readonly Amount[]) =>
  amount.minus(sum(refunds));

/**
 * Usar el saldo a favor del alumno: cada pago con saldo (en el orden recibido, del más viejo al más
 * nuevo) se imputa a las cuotas pendientes de la más vieja a la más nueva. Devuelve las filas a
 * agregar por pago; no toca la caja.
 */
export function buildCreditApplicationPlan(
  credits: readonly Readonly<{ paymentId: string; credit: Prisma.Decimal }>[],
  charges: readonly ChargeForPaymentAllocation[],
) {
  let current = charges.map((charge) => ({ ...charge, allocations: [...charge.allocations] }));
  const rows: {
    paymentId: string;
    allocations: { monthlyChargeId: string; amount: Prisma.Decimal }[];
  }[] = [];
  for (const { paymentId, credit } of credits) {
    if (credit.lessThanOrEqualTo(0)) continue;
    const { allocations } = buildPaymentAllocationPlan(current, credit);
    if (allocations.length === 0) break;
    rows.push({ paymentId, allocations });
    current = current.map((charge) => {
      const applied = allocations.find(({ monthlyChargeId }) => monthlyChargeId === charge.id);
      return applied
        ? { ...charge, allocations: [...charge.allocations, { amount: applied.amount }] }
        : charge;
    });
  }
  if (rows.length === 0)
    throw new DomainError(
      'PAYMENT_NO_CREDIT',
      'No hay saldo a favor o cuotas pendientes donde aplicarlo',
    );
  return rows;
}

/**
 * Usar saldo a favor en un otro cobro: toma de cada pago con saldo (del más viejo al más nuevo)
 * hasta cubrir el importe. Si no alcanza, se rechaza con el disponible.
 */
export function buildCreditUsePlan(
  credits: readonly Readonly<{ paymentId: string; credit: Prisma.Decimal }>[],
  amount: Prisma.Decimal,
) {
  let remaining = amount;
  const rows: { sourcePaymentId: string; amount: Prisma.Decimal }[] = [];
  for (const { paymentId, credit } of credits) {
    if (remaining.isZero()) break;
    if (credit.lessThanOrEqualTo(0)) continue;
    const used = Prisma.Decimal.min(credit, remaining);
    rows.push({ sourcePaymentId: paymentId, amount: used });
    remaining = remaining.minus(used);
  }
  if (!remaining.isZero()) {
    const available = credits.reduce(
      (total, { credit }) => total.plus(Prisma.Decimal.max(credit, 0)),
      new Prisma.Decimal(0),
    );
    throw new DomainError(
      'PAYMENT_EXCEEDS_CREDIT',
      `El saldo a favor disponible es ${available.toFixed(2)}`,
      { field: 'creditAmount', creditAmount: available.toFixed(2) },
    );
  }
  return rows;
}

/** La devolución no puede superar el saldo a favor del pago. */
export const assertRefundFits = (refund: Prisma.Decimal, credit: Prisma.Decimal) => {
  if (credit.lessThanOrEqualTo(0))
    throw new DomainError('PAYMENT_NO_CREDIT', 'El pago no tiene saldo a favor para devolver');
  if (refund.greaterThan(credit))
    throw new DomainError(
      'PAYMENT_REFUND_EXCEEDS_CREDIT',
      `La devolución supera el saldo a favor del pago (${credit.toFixed(2)})`,
      { field: 'amount', creditAmount: credit.toFixed(2) },
    );
};
