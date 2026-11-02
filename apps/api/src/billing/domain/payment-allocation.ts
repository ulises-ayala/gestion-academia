import { Prisma } from '@academy/database';
import { DomainError } from '../../shared/domain/domain-error';

export type ChargeForPaymentAllocation = Readonly<{
  id: string;
  studentDueAmount: Prisma.Decimal;
  dueDate: Date;
  createdAt: Date;
  allocations: readonly Readonly<{ amount: Prisma.Decimal }>[];
}>;

export const confirmedAllocatedAmount = (
  allocations: readonly Readonly<{ amount: Prisma.Decimal }>[],
) => allocations.reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0));

export const paymentChargeStatus = (paid: Prisma.Decimal, studentDueAmount: Prisma.Decimal) =>
  paid.isZero()
    ? ('PENDING' as const)
    : paid.greaterThanOrEqualTo(studentDueAmount)
      ? ('PAID' as const)
      : ('PARTIAL' as const);

export function buildPaymentAllocationPlan(
  charges: readonly ChargeForPaymentAllocation[],
  paymentAmount: Prisma.Decimal,
) {
  const balances = [...charges]
    .sort(
      (left, right) =>
        left.dueDate.getTime() - right.dueDate.getTime() ||
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.id.localeCompare(right.id),
    )
    .map((charge) => {
      const paid = confirmedAllocatedAmount(charge.allocations);
      const outstanding = Prisma.Decimal.max(charge.studentDueAmount.minus(paid), 0);
      return { charge, paid, outstanding };
    });
  const totalOutstanding = balances.reduce(
    (sum, balance) => sum.plus(balance.outstanding),
    new Prisma.Decimal(0),
  );
  let remaining = paymentAmount;
  const allocations: { monthlyChargeId: string; amount: Prisma.Decimal }[] = [];
  for (const balance of balances) {
    if (remaining.isZero()) break;
    if (balance.outstanding.isZero()) continue;
    const applied = Prisma.Decimal.min(remaining, balance.outstanding);
    allocations.push({ monthlyChargeId: balance.charge.id, amount: applied });
    remaining = remaining.minus(applied);
  }
  return { balances, totalOutstanding, allocations, remaining };
}

type AllocationRow = Readonly<{ monthlyChargeId: string; amount: Prisma.Decimal }>;

/**
 * Imputación vigente de un pago por cuota: suma sus filas (la original y las de cada reimputación)
 * y descarta las cuotas que quedaron en cero. Conserva el orden en que aparece cada cuota.
 */
export function netAllocations<T extends AllocationRow>(rows: readonly T[]) {
  const byCharge = new Map<string, { row: T; amount: Prisma.Decimal }>();
  for (const row of rows) {
    const current = byCharge.get(row.monthlyChargeId);
    if (current) current.amount = current.amount.plus(row.amount);
    else byCharge.set(row.monthlyChargeId, { row, amount: row.amount });
  }
  return [...byCharge.values()]
    .filter(({ amount }) => amount.greaterThan(0))
    .map(({ row, amount }) => ({ ...row, amount }));
}

export type ChargeForReallocation = Readonly<{
  id: string;
  studentDueAmount: Prisma.Decimal;
  /** Lo imputado a la cuota por todos los pagos confirmados, este incluido. */
  paid: Prisma.Decimal;
}>;

/**
 * Filas que agrega una reimputación para pasar el pago de su imputación vigente (`current`) a la
 * pedida (`target`): negativas en las cuotas que pierden, positivas en las que ganan. El total no
 * cambia y ninguna cuota puede quedar pagada de más.
 */
export function buildReallocationPlan(
  paymentAmount: Prisma.Decimal,
  current: readonly AllocationRow[],
  target: readonly AllocationRow[],
  charges: readonly ChargeForReallocation[],
) {
  const total = target.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
  if (!total.equals(paymentAmount))
    throw new DomainError(
      'VALIDATION_ERROR',
      `Las cuotas tienen que sumar el importe del pago (${paymentAmount.toFixed(2)})`,
      { field: 'allocations' },
    );
  const amountOf = (rows: readonly AllocationRow[], chargeId: string) =>
    rows
      .filter((row) => row.monthlyChargeId === chargeId)
      .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
  const chargeIds = [
    ...new Set([...current, ...target].map(({ monthlyChargeId }) => monthlyChargeId)),
  ];
  const rows = chargeIds
    .map((monthlyChargeId) => ({
      monthlyChargeId,
      amount: amountOf(target, monthlyChargeId).minus(amountOf(current, monthlyChargeId)),
    }))
    .filter(({ amount }) => !amount.isZero());
  if (rows.length === 0)
    throw new DomainError('VALIDATION_ERROR', 'La imputación no cambia', {
      field: 'allocations',
    });
  for (const row of rows) {
    if (row.amount.isNegative()) continue;
    const charge = charges.find(({ id }) => id === row.monthlyChargeId);
    if (!charge) throw new DomainError('MONTHLY_CHARGE_NOT_FOUND', 'Cuota no encontrada');
    const available = Prisma.Decimal.max(charge.studentDueAmount.minus(charge.paid), 0);
    if (row.amount.greaterThan(available))
      throw new DomainError(
        'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE',
        'El importe supera lo que falta pagar de la cuota',
        { monthlyChargeId: charge.id, outstandingAmount: available.toFixed(2) },
      );
  }
  return [...rows].sort((left, right) => left.amount.comparedTo(right.amount));
}
