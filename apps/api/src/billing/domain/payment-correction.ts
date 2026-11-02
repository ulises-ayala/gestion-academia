import { businessDayAt } from '../../dashboard/application/business-day';
import { DomainError } from '../../shared/domain/domain-error';

type Tender = Readonly<{ method: string; amount: string }>;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fecha real de un pago cargado tarde: el mediodía de ese día en Argentina, o null si es hoy (el
 * pago queda con la hora de carga). No se admite una fecha futura.
 */
export const backdatedPaidAt = (paidDate: unknown, now: Date, timeZone: string) => {
  if (paidDate === undefined || paidDate === null || paidDate === '') return null;
  const value = typeof paidDate === 'string' ? paidDate : '';
  const parsed = new Date(`${value}T15:00:00.000Z`);
  if (
    !datePattern.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new DomainError('VALIDATION_ERROR', 'La fecha del pago no es válida', {
      field: 'paidDate',
    });
  const today = businessDayAt(now, timeZone).date;
  if (value > today)
    throw new DomainError('VALIDATION_ERROR', 'La fecha del pago no puede ser futura', {
      field: 'paidDate',
    });
  return value === today ? null : parsed;
};

/**
 * Fecha del pago corregido. Sin fecha se conserva la del original. Con fecha: si es el mismo día
 * se conserva la hora original; si no, se guarda al mediodía de ese día (Argentina) para que caiga
 * en el día correcto en reportes. No se admite una fecha futura.
 */
export const correctedPaidAt = (
  originalPaidAt: Date,
  paidDate: unknown,
  now: Date,
  timeZone: string,
) => {
  if (paidDate === undefined || paidDate === null || paidDate === '') return originalPaidAt;
  const parsed = backdatedPaidAt(paidDate, now, timeZone) ?? now;
  return businessDayAt(originalPaidAt, timeZone).date === paidDate ? originalPaidAt : parsed;
};

const tenderKey = (tenders: readonly Tender[]) =>
  tenders
    .map((tender) => `${tender.method}:${Number(tender.amount).toFixed(2)}`)
    .sort()
    .join('|');

/** true si la corrección cambia los medios, los importes o la fecha del pago. */
export const paymentCorrectionChanges = (
  original: Readonly<{ tenders: readonly Tender[]; paidAt: Date }>,
  next: Readonly<{ tenders: readonly Tender[]; paidAt: Date }>,
) =>
  tenderKey(original.tenders) !== tenderKey(next.tenders) ||
  original.paidAt.getTime() !== next.paidAt.getTime();
