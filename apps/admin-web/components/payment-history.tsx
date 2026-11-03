import type { PaymentDto } from '@academy/contracts';
import React from 'react';
import { describeOtherPayment } from '../lib/other-payment';
import { payerDni, payerName, paymentMethodLabels } from '../lib/payments';
import { chargeLabel } from '../lib/collect-payment';
import { PaymentActions, paymentStatusLabel } from './payment-actions';

const money = (value: string | number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Buenos_Aires',
  }).format(new Date(value));

export function PaymentHistory({
  canVoid,
  payments,
  showStudent = false,
  studentHref,
  receiptPhone,
  showReceipts = false,
  onVoid,
  onCorrect,
}: Readonly<{
  canVoid: boolean;
  payments: readonly PaymentDto[];
  showStudent?: boolean;
  studentHref?(id: string): string;
  /** Con el alumno ya elegido, ofrece reenviar el recibo a este teléfono por WhatsApp. */
  receiptPhone?: string | null;
  /** Sin alumno elegido: recibo por WhatsApp al teléfono de cada pago. */
  showReceipts?: boolean;
  onVoid(payment: PaymentDto): void;
  /** Corregir medio, importe o fecha (mismos permisos que anular). */
  onCorrect?(payment: PaymentDto): void;
}>) {
  return (
    <div className="table-wrap payment-history-table">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            {showStudent && <th>Alumno</th>}
            <th>Monto</th>
            <th>Medios</th>
            <th>Aplicación</th>
            <th>Registrado por</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td data-label="Fecha">{dateTime(payment.paidAt)}</td>
              {showStudent && (
                <td data-label="Alumno">
                  {payment.student ? (
                    <a className="text-link" href={studentHref?.(payment.student.id)}>
                      {payerName(payment)}
                    </a>
                  ) : (
                    payerName(payment)
                  )}
                  {payerDni(payment) && (
                    <small className="table-subline">DNI {payerDni(payment)}</small>
                  )}
                </td>
              )}
              <td data-label="Monto" className="nowrap">
                <strong>{money(payment.amount)}</strong>
              </td>
              <td data-label="Medios">
                <ul className="payment-breakdown">
                  {payment.tenders.map((tender) => (
                    <li key={tender.id}>
                      {paymentMethodLabels[tender.method]} {money(tender.amount)}
                    </li>
                  ))}
                </ul>
              </td>
              <td data-label="Aplicación">
                <ul className="payment-breakdown">
                  {payment.kind === 'OTHER' && (
                    <li>{describeOtherPayment(payment.otherConcept)}</li>
                  )}
                  {payment.allocations.map((allocation) => (
                    <li key={allocation.monthlyChargeId}>
                      {allocation.academicClass.name} {chargeLabel(allocation)}:{' '}
                      {money(allocation.amount)}
                    </li>
                  ))}
                  {Number(payment.creditAmount) > 0 && (
                    <li>Saldo a favor: {money(payment.creditAmount)}</li>
                  )}
                  {Number(payment.refundedAmount) > 0 && (
                    <li>Devuelto: {money(payment.refundedAmount)}</li>
                  )}
                </ul>
              </td>
              <td data-label="Registrado por">{payment.createdBy.username}</td>
              <td data-label="Estado">
                <span className={`status ${payment.status === 'CONFIRMED' ? 'active' : 'void'}`}>
                  {paymentStatusLabel(payment)}
                </span>
                {payment.correctionOfId && (
                  <small className="table-subline">Corrección de un pago anterior</small>
                )}
              </td>
              <td data-label="Acciones">
                <PaymentActions
                  payment={payment}
                  receiptPhone={
                    receiptPhone !== undefined
                      ? receiptPhone
                      : showReceipts
                        ? (payment.student?.phone ?? payment.walkIn?.phone ?? null)
                        : undefined
                  }
                  canVoid={canVoid}
                  onCorrect={onCorrect}
                  onVoid={onVoid}
                  layout="stack"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
