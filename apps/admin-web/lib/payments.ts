import type { CreatePaymentDto, MonthlyChargeDto, PaymentMethodDto } from '@academy/contracts';

export const paymentMethodLabels: Readonly<Record<PaymentMethodDto, string>> = {
  CASH: 'Efectivo',
  MERCADO_PAGO: 'Mercado Pago',
  CARD: 'Tarjeta',
};

export type TenderAmounts = Readonly<Record<PaymentMethodDto, string>>;
export type AllocationPreview = Readonly<{
  charge: MonthlyChargeDto;
  amount: string;
}>;

export const decimalToCents = (value: string): bigint | null => {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = '0', decimal = ''] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'));
};

export const centsToDecimal = (value: bigint) =>
  `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;

export const openCharges = (charges: readonly MonthlyChargeDto[]) =>
  charges
    .filter(
      (charge) =>
        (charge.status === 'PENDING' || charge.status === 'PARTIAL') &&
        decimalToCents(charge.outstandingAmount) !== 0n,
    )
    .sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    );

export const outstandingTotal = (charges: readonly MonthlyChargeDto[]) =>
  centsToDecimal(
    openCharges(charges).reduce(
      (sum, charge) => sum + (decimalToCents(charge.outstandingAmount) ?? 0n),
      0n,
    ),
  );

export const tenderTotal = (tenders: TenderAmounts) =>
  (Object.values(tenders) as string[]).reduce(
    (sum, amount) => sum + (decimalToCents(amount || '0') ?? 0n),
    0n,
  );

export const paymentSubmissionDisabled = (
  total: bigint,
  outstanding: bigint,
  invalidTender: boolean,
  submitting: boolean,
) => total <= 0n || total > outstanding || invalidTender || submitting;

export const previewAllocations = (
  charges: readonly MonthlyChargeDto[],
  total: bigint,
): readonly AllocationPreview[] => {
  let remaining = total;
  const result: AllocationPreview[] = [];
  for (const charge of openCharges(charges)) {
    if (remaining <= 0n) break;
    const outstanding = decimalToCents(charge.outstandingAmount) ?? 0n;
    const amount = remaining < outstanding ? remaining : outstanding;
    if (amount > 0n) result.push({ charge, amount: centsToDecimal(amount) });
    remaining -= amount;
  }
  return result;
};

export const createPaymentPayload = (
  studentId: string,
  tenders: TenderAmounts,
): CreatePaymentDto => ({
  studentId,
  tenders: (Object.entries(tenders) as [PaymentMethodDto, string][])
    .map(([method, amount]) => ({ method, cents: decimalToCents(amount || '0') }))
    .filter((tender): tender is { method: PaymentMethodDto; cents: bigint } =>
      Boolean(tender.cents && tender.cents > 0n),
    )
    .map(({ method, cents }) => ({ method, amount: centsToDecimal(cents) })),
});
