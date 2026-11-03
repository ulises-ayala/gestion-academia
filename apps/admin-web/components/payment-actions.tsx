import type { PaymentDto } from '@academy/contracts';
import { Ban, MessageCircle, Pencil } from 'lucide-react';
import React from 'react';
import { chargeLabel } from '../lib/collect-payment';
import { describeOtherPayment } from '../lib/other-payment';
import { paymentMethodLabels } from '../lib/payments';
import { whatsappReceiptUrl } from '../lib/whatsapp-receipt';

const money = (value: string | number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Buenos_Aires',
  }).format(new Date(value));

export const paymentStatusLabel = (payment: PaymentDto) =>
  payment.status === 'CONFIRMED' ? 'Confirmado' : payment.correctedById ? 'Corregido' : 'Anulado';

export const paymentApplication = (payment: PaymentDto) =>
  payment.kind === 'OTHER'
    ? [
        describeOtherPayment(payment.otherConcept),
        ...(Number(payment.paidWithCreditAmount) > 0
          ? [`Con saldo a favor: ${money(payment.paidWithCreditAmount)}`]
          : []),
      ]
    : [
        ...payment.allocations.map(
          (allocation) =>
            `${allocation.academicClass.name} · ${chargeLabel(allocation)}: ${money(allocation.amount)}`,
        ),
        ...(Number(payment.creditAmount) > 0
          ? [`Saldo a favor: ${money(payment.creditAmount)}`]
          : []),
        ...(Number(payment.refundedAmount) > 0
          ? [`Devuelto: ${money(payment.refundedAmount)}`]
          : []),
      ];

/**
 * Recibo por WhatsApp, Corregir y Anular: mismo tamaño y un color por acción, para que no se
 * confundan. Solo en pagos confirmados.
 */
export function PaymentActions({
  payment,
  receiptPhone,
  canVoid,
  onCorrect,
  onVoid,
  layout = 'row',
}: Readonly<{
  payment: PaymentDto;
  /** Teléfono para el recibo; undefined no ofrece WhatsApp, null lo ofrece sin número. */
  receiptPhone?: string | null | undefined;
  canVoid: boolean;
  onCorrect?: ((payment: PaymentDto) => void) | undefined;
  onVoid?: ((payment: PaymentDto) => void) | undefined;
  layout?: 'row' | 'stack';
}>) {
  if (payment.status !== 'CONFIRMED') return null;
  const correct = canVoid && onCorrect;
  // Con devoluciones de saldo a favor el pago ya no se anula (la plata salió de la caja).
  const cancel = canVoid && onVoid && Number(payment.refundedAmount) === 0;
  if (receiptPhone === undefined && !correct && !cancel) return null;
  return (
    <div className={`payment-actions is-${layout}`}>
      {receiptPhone !== undefined && (
        <a
          className="payment-action is-whatsapp"
          href={whatsappReceiptUrl(payment, receiptPhone)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Enviar recibo por WhatsApp"
          title="Enviar recibo por WhatsApp"
        >
          <MessageCircle aria-hidden="true" size={15} />
          WhatsApp
        </a>
      )}
      {correct && (
        <button
          type="button"
          className="payment-action is-correct"
          title={
            Number(payment.creditAmount) > 0
              ? 'Corregir, aplicar o devolver el saldo a favor'
              : 'Corregir medio, importe, fecha o cuotas'
          }
          onClick={() => onCorrect(payment)}
        >
          <Pencil aria-hidden="true" size={15} />
          {Number(payment.creditAmount) > 0 ? 'Saldo a favor' : 'Corregir'}
        </button>
      )}
      {cancel && (
        <button
          type="button"
          className="payment-action is-void"
          title="Anular el pago"
          onClick={() => onVoid(payment)}
        >
          <Ban aria-hidden="true" size={15} />
          Anular
        </button>
      )}
    </div>
  );
}

/** Pagos de un alumno en tarjetas compactas (ficha y estado de cuenta). */
export function StudentPaymentList({
  payments,
  receiptPhone,
  canVoid = false,
  onCorrect,
  onVoid,
}: Readonly<{
  payments: readonly PaymentDto[];
  receiptPhone?: string | null | undefined;
  canVoid?: boolean;
  onCorrect?: ((payment: PaymentDto) => void) | undefined;
  onVoid?: ((payment: PaymentDto) => void) | undefined;
}>) {
  return (
    <ul className="student-payment-cards">
      {payments.map((payment) => (
        <li key={payment.id} className={payment.status === 'CONFIRMED' ? '' : 'is-void'}>
          <div className="student-payment-top">
            <strong>{money(payment.amount)}</strong>
            <span className={`status ${payment.status === 'CONFIRMED' ? 'active' : 'void'}`}>
              {paymentStatusLabel(payment)}
            </span>
          </div>
          <p className="student-payment-meta">
            {dateTime(payment.paidAt)} ·{' '}
            {payment.tenders
              .map((tender) => `${paymentMethodLabels[tender.method]} ${money(tender.amount)}`)
              .join(' + ')}
          </p>
          <ul className="student-payment-items">
            {paymentApplication(payment).map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
          <p className="student-payment-meta">
            Registrado por {payment.createdBy.username}
            {payment.correctionOfId ? ' · corrección de un pago anterior' : ''}
          </p>
          <PaymentActions
            payment={payment}
            receiptPhone={receiptPhone}
            canVoid={canVoid}
            onCorrect={onCorrect}
            onVoid={onVoid}
          />
        </li>
      ))}
    </ul>
  );
}
