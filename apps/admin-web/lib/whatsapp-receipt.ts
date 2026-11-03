import type { PaymentDto } from '@academy/contracts';
import { chargeLabel, money } from './collect-payment';
import { describeOtherPayment } from './other-payment';
import { payerDni, payerName, paymentMethodLabels } from './payments';

/** Teléfono de la academia que figura al pie del recibo. */
export const ACADEMY_CONTACT_PHONE = '370 508-4498';

/**
 * Número en el formato que pide WhatsApp para un celular argentino (549 + área + número, sin el
 * 0 ni el 15). Acepta como se carga en la ficha: "3705032792", "0370 15 503-2792",
 * "+54 9 370 503 2792". Si no se puede deducir, devuelve null.
 */
export const whatsappNumber = (phone: string | null | undefined): string | null => {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('549') && digits.length === 13) return digits;
  if (digits.startsWith('54') && digits.length === 12) return `549${digits.slice(2)}`;
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) return `549${digits}`;
  // Con el 15 después del código de área (de 2 a 4 dígitos).
  if (digits.length === 12)
    for (const areaLength of [2, 3, 4])
      if (digits.slice(areaLength, areaLength + 2) === '15')
        return `549${digits.slice(0, areaLength)}${digits.slice(areaLength + 2)}`;
  return null;
};

const dateTime = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Buenos_Aires',
  }).format(new Date(value));

/** Texto del recibo, con el formato de WhatsApp (*negrita*). */
export const receiptText = (payment: PaymentDto, remainingDebt?: string | null): string => {
  const items =
    payment.kind === 'OTHER'
      ? [`• ${describeOtherPayment(payment.otherConcept)}: ${money(payment.amount)}`]
      : payment.allocations.map(
          (allocation) =>
            `• ${allocation.academicClass.name} · ${chargeLabel(allocation)}: ${money(allocation.amount)}`,
        );
  // El recargo por tarjeta se cobra con el cobro de cuotas: va en el mismo recibo.
  const surcharge = payment.cardSurcharge;
  if (surcharge) items.push(`• Recargo por tarjeta: ${money(surcharge.amount)}`);
  const methods = [
    ...payment.tenders.map(
      (tender) => `${paymentMethodLabels[tender.method]} ${money(tender.amount)}`,
    ),
    ...(surcharge ? [`Tarjeta ${money(surcharge.amount)} (recargo)`] : []),
  ].join(' + ');
  const total = surcharge
    ? (Number(payment.amount) + Number(surcharge.amount)).toFixed(2)
    : payment.amount;
  const balance =
    remainingDebt === undefined || remainingDebt === null
      ? []
      : [Number(remainingDebt) > 0 ? `Saldo pendiente: ${money(remainingDebt)}` : 'Cuenta al día.'];
  return [
    '*Carmesí* · Comprobante de pago',
    '',
    `Alumno/a: ${payerName(payment)}${payerDni(payment) ? ` (DNI ${payerDni(payment)})` : ''}`,
    `Fecha: ${dateTime(payment.paidAt)}`,
    '',
    ...items,
    '',
    `Medio de pago: ${methods}`,
    `*Total: ${money(total)}*`,
    ...(Number(payment.creditAmount) > 0 ? [`Queda a favor: ${money(payment.creditAmount)}`] : []),
    ...balance,
    '',
    `Comprobante N.º ${payment.id.slice(0, 8).toUpperCase()}`,
    `Consultas: ${ACADEMY_CONTACT_PHONE}`,
  ].join('\n');
};

/** Enlace que abre WhatsApp con el recibo escrito; sin número, WhatsApp pide elegir el chat. */
export const whatsappReceiptUrl = (
  payment: PaymentDto,
  phone: string | null | undefined,
  remainingDebt?: string | null,
) => {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(receiptText(payment, remainingDebt))}`;
};
