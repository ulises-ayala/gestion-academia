'use client';

import type {
  MonthlyChargeListDto,
  PaymentDto,
  PaymentListDto,
  PaymentMethodDto,
  StudentDto,
  StudentListDto,
} from '@academy/contracts';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PermissionGate } from '../../components/permission-gate';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { businessToday, formatDate } from '../../lib/dates';
import { createPaymentPayload, paymentMethodLabels, selectedTotal } from '../../lib/payments';

const money = (value: string | number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value));
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Buenos_Aires',
  }).format(new Date(value));

export default function PaymentsPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly StudentDto[]>([]);
  const [student, setStudent] = useState<StudentDto | null>(null);
  const [charges, setCharges] = useState<MonthlyChargeListDto['items']>([]);
  const [payments, setPayments] = useState<PaymentListDto['items']>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<PaymentMethodDto>('CASH');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadStudent = useCallback(async (selectedStudent: StudentDto) => {
    setStudent(selectedStudent);
    setSelected(new Set());
    setMessage('');
    const [chargeResult, paymentResult] = await Promise.all([
      apiRequest<MonthlyChargeListDto>(`/monthly-charges?studentId=${selectedStudent.id}`),
      apiRequest<PaymentListDto>(`/payments?studentId=${selectedStudent.id}&pageSize=100`),
    ]);
    setCharges(chargeResult.items);
    setPayments(paymentResult.items);
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('studentId');
    if (id)
      void apiRequest<StudentDto>(`/students/${id}`)
        .then(loadStudent)
        .catch(() => setMessage('No se pudo seleccionar el alumno indicado.'));
  }, [loadStudent]);

  async function search(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!query.trim()) return setResults([]);
    try {
      setResults(
        (
          await apiRequest<StudentListDto>(
            `/students?q=${encodeURIComponent(query.trim())}&pageSize=10`,
          )
        ).items,
      );
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo buscar alumnos');
    }
  }

  const pending = charges.filter((charge) => charge.status === 'PENDING');
  const total = useMemo(() => selectedTotal(pending, selected), [pending, selected]);
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function collect() {
    setSubmitting(true);
    setMessage('');
    try {
      await apiRequest<PaymentDto>('/payments', {
        method: 'POST',
        body: JSON.stringify(createPaymentPayload(selected, method)),
      });
      if (student) await loadStudent(student);
      setMessage('Pago registrado correctamente.');
    } catch (error) {
      setMessage(
        error instanceof ApiClientError && error.status === 409
          ? 'Otra operación modificó una cuota seleccionada. Actualizá e intentá nuevamente.'
          : error instanceof ApiClientError
            ? error.message
            : 'No se pudo registrar el pago',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function voidPayment(payment: PaymentDto) {
    if (!confirm('¿Confirmás la anulación de este pago? Las cuotas volverán a quedar pendientes.'))
      return;
    try {
      await apiRequest(`/payments/${payment.id}/void`, { method: 'POST' });
      if (student) await loadStudent(student);
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'No se pudo anular el pago');
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Facturación</p>
          <h1>Pagos</h1>
          <p className="subtitle">Cobro de cuotas completas e historial financiero.</p>
        </div>
      </div>
      <section className="card">
        <h2>Buscar alumno</h2>
        <form className="filters" onSubmit={search}>
          <label className="search-field">
            DNI o nombre
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar alumno"
            />
          </label>
          <button>Buscar</button>
        </form>
        {results.length > 0 && (
          <div className="selection-list">
            {results.map((item) => (
              <button
                className="secondary"
                key={item.id}
                onClick={() => void loadStudent(item)}
                type="button"
              >
                <strong>
                  {item.lastName}, {item.firstName}
                </strong>{' '}
                · DNI {item.dni}
              </button>
            ))}
          </div>
        )}
        {message && (
          <p className="message" role="alert">
            {message}
          </p>
        )}
      </section>
      {student && (
        <>
          <section className="card">
            <p className="eyebrow">Alumno seleccionado</p>
            <h2>
              {student.firstName} {student.lastName}
            </h2>
            <p>DNI {student.dni}</p>
          </section>
          <section className="card">
            <h2>Cuotas pendientes</h2>
            {charges.length === 0 ? (
              <p className="empty-state">No hay cuotas registradas para este alumno.</p>
            ) : pending.length === 0 ? (
              <p className="empty-state">Este alumno no tiene cuotas pendientes.</p>
            ) : (
              <div className="payment-charge-list">
                {pending.map((charge) => {
                  const overdue = businessToday() > charge.dueDate;
                  return (
                    <label className="enrollment-card" key={charge.id}>
                      <input
                        type="checkbox"
                        checked={selected.has(charge.id)}
                        onChange={() => toggle(charge.id)}
                      />
                      <span>
                        <strong>{charge.academicClass.name}</strong>
                        <br />
                        {charge.period} · vence {formatDate(charge.dueDate)}{' '}
                        {overdue && <span className="status void">Vencida</span>}
                      </span>
                      <strong>{money(charge.finalAmount)}</strong>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="payment-summary">
              <strong>
                {selected.size} cuota{selected.size === 1 ? '' : 's'} seleccionada
                {selected.size === 1 ? '' : 's'}
              </strong>
              <strong>Total: {money(total)}</strong>
              <label>
                Medio de pago
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value as PaymentMethodDto)}
                >
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={selected.size === 0 || submitting} onClick={() => void collect()}>
                {submitting ? 'Registrando…' : 'Registrar pago'}
              </button>
            </div>
          </section>
          <section className="card">
            <h2>Historial</h2>
            {payments.length === 0 ? (
              <p className="empty-state">No hay pagos registrados.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Cuotas</th>
                      <th>Medio</th>
                      <th>Importe</th>
                      <th>Registrado por</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{dateTime(payment.paidAt)}</td>
                        <td>
                          {payment.allocations
                            .map(
                              (allocation) =>
                                `${allocation.academicClass.name} ${allocation.period}`,
                            )
                            .join(', ')}
                        </td>
                        <td>{paymentMethodLabels[payment.paymentMethod]}</td>
                        <td>{money(payment.amount)}</td>
                        <td>{payment.createdBy.username}</td>
                        <td>
                          <span
                            className={`status ${payment.status === 'CONFIRMED' ? 'active' : 'void'}`}
                          >
                            {payment.status === 'CONFIRMED' ? 'Confirmado' : 'Anulado'}
                          </span>
                        </td>
                        <td>
                          <PermissionGate permission="payments:void">
                            {payment.status === 'CONFIRMED' && (
                              <button
                                className="secondary"
                                onClick={() => void voidPayment(payment)}
                              >
                                Anular
                              </button>
                            )}
                          </PermissionGate>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
