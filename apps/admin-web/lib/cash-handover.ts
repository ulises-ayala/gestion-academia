import type { CashHandoverDto, CreateCashHandoverDto } from '@academy/contracts';
import { normalizeAmount } from './collect-payment';
import { centsToDecimal, decimalToCents } from './payments';

export type CashHandoverForm = Readonly<{
  fromDate: string;
  toDate: string;
  amount: string;
  receivedBy: string;
  note: string;
}>;

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

/**
 * Período que se propone para la próxima entrega: desde el día siguiente a la última entrega
 * vigente hasta hoy; sin entregas previas, la última semana.
 */
export const nextHandoverPeriod = (handovers: readonly CashHandoverDto[], today: string) => {
  const last = handovers
    .filter((item) => !item.voidedAt)
    .reduce<string | null>((max, item) => (max && max > item.toDate ? max : item.toDate), null);
  const fromDate = last && last < today ? addDays(last, 1) : addDays(today, -6);
  return { fromDate, toDate: today };
};

/** Primer motivo por el que no se puede registrar la entrega, o null. */
export const handoverProblem = (form: CashHandoverForm, today: string) => {
  if (!form.fromDate || !form.toDate) return 'Indicá desde y hasta qué fecha es la recaudación.';
  if (form.toDate < form.fromDate) return 'La fecha final no puede ser anterior a la inicial.';
  if (form.toDate > today) return 'El período no puede terminar en el futuro.';
  const cents = form.amount.trim() ? decimalToCents(normalizeAmount(form.amount)) : null;
  if (cents === null || cents <= 0n) return 'Ingresá el importe entregado.';
  return null;
};

export const handoverPayload = (form: CashHandoverForm): CreateCashHandoverDto => ({
  fromDate: form.fromDate,
  toDate: form.toDate,
  amount: centsToDecimal(decimalToCents(normalizeAmount(form.amount)) ?? 0n),
  receivedBy: form.receivedBy.trim() || null,
  note: form.note.trim() || null,
});
