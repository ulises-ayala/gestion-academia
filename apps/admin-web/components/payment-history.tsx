import type { PaymentDto } from '@academy/contracts';
import React from 'react';
import { paymentMethodLabels } from '../lib/payments';

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
  onVoid,
}: Readonly<{
  canVoid: boolean;
  payments: readonly PaymentDto[];
  showStudent?: boolean;
  studentHref?(id: string): string;
  onVoid(payment: PaymentDto): void;
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
                  <a className="text-link" href={studentHref?.(payment.student.id)}>
                    {payment.student.firstName} {payment.student.lastName}
                  </a>
                  <small className="table-subline">DNI {payment.student.dni}</small>
                </td>
              )}
              <td data-label="Monto">
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
                  {payment.allocations.map((allocation) => (
                    <li key={allocation.monthlyChargeId}>
                      {allocation.academicClass.name} {allocation.period}:{' '}
                      {money(allocation.amount)}
                    </li>
                  ))}
                </ul>
              </td>
              <td data-label="Registrado por">{payment.createdBy.username}</td>
              <td data-label="Estado">
                <span className={`status ${payment.status === 'CONFIRMED' ? 'active' : 'void'}`}>
                  {payment.status === 'CONFIRMED' ? 'Confirmado' : 'Anulado'}
                </span>
              </td>
              <td data-label="Acciones">
                {canVoid && payment.status === 'CONFIRMED' && (
                  <button className="secondary" onClick={() => onVoid(payment)}>
                    Anular
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
