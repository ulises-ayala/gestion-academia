import type { CreatePaymentDto, MonthlyChargeDto, PaymentMethodDto } from '@academy/contracts';

export const paymentMethodLabels: Readonly<Record<PaymentMethodDto, string>> = {
  CASH: 'Efectivo',
  MERCADO_PAGO: 'Mercado Pago',
  CARD: 'Tarjeta',
};
export const selectedTotal = (charges: readonly MonthlyChargeDto[], ids: ReadonlySet<string>) =>
  charges
    .filter((charge) => ids.has(charge.id))
    .reduce((sum, charge) => sum + Number(charge.finalAmount), 0);
export const createPaymentPayload = (
  ids: ReadonlySet<string>,
  paymentMethod: PaymentMethodDto,
): CreatePaymentDto => ({ monthlyChargeIds: [...ids], paymentMethod });
