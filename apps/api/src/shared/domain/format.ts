import type { PaymentMethodDto } from '@academy/contracts';

/** Nombre de cada medio de pago, como lo ven la academia, los reportes y los PDF. */
export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethodDto, string>> = {
  CASH: 'Efectivo',
  MERCADO_PAGO: 'Mercado Pago',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

/** Importe en pesos con centavos: "$ 40.000,00". */
export const formatMoney = (value: string | number) => ars.format(Number(value));

/** "2026-10-05" (o un instante ISO, del que se toma el día) → "05/10/2026". */
export const formatDate = (value: string) => value.slice(0, 10).split('-').reverse().join('/');

/** "2026-10-05" → "05/10". */
export const formatDayMonth = (value: string) => formatDate(value).slice(0, 5);
