import { Prisma } from '@academy/database';

export type ChargeForPaymentAllocation = Readonly<{
  id: string;
  finalAmount: Prisma.Decimal;
  dueDate: Date;
  createdAt: Date;
  allocations: readonly Readonly<{ amount: Prisma.Decimal }>[];
}>;

export const confirmedAllocatedAmount = (
  allocations: readonly Readonly<{ amount: Prisma.Decimal }>[],
) => allocations.reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0));

export const paymentChargeStatus = (paid: Prisma.Decimal, finalAmount: Prisma.Decimal) =>
  paid.isZero()
    ? ('PENDING' as const)
    : paid.greaterThanOrEqualTo(finalAmount)
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
      const outstanding = Prisma.Decimal.max(charge.finalAmount.minus(paid), 0);
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
