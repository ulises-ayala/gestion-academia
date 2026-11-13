import type { ClosingKindDto, CreateClosingDto } from '@academy/contracts';
import { dayMonthYear } from './dates';
import { periodLabel } from './charge-generation';

export const closingKindLabels: Readonly<Record<ClosingKindDto, string>> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
};

/** "Del 02/11/2026 al 08/11/2026" o "Octubre de 2026". */
export const closingPeriodLabel = (kind: ClosingKindDto, fromDate: string, toDate: string) => {
  if (kind === 'MONTHLY') {
    return periodLabel(fromDate.slice(0, 7));
  }
  return `Del ${dayMonthYear(fromDate)} al ${dayMonthYear(toDate)}`;
};

/** Período elegido en la pantalla, como lo pide la API. */
export const closingPayload = (
  kind: ClosingKindDto,
  period: Readonly<{ fromDate: string; toDate: string }>,
): CreateClosingDto =>
  kind === 'MONTHLY'
    ? { kind, month: period.fromDate.slice(0, 7) }
    : { kind, fromDate: period.fromDate, toDate: period.toDate };

/** Parámetros de la vista previa para el período elegido. */
export const closingPreviewQuery = (
  kind: ClosingKindDto,
  period: Readonly<{ fromDate: string; toDate: string }> | null,
) => {
  const params = new URLSearchParams({ kind });
  if (period && kind === 'MONTHLY') params.set('month', period.fromDate.slice(0, 7));
  if (period && kind === 'WEEKLY') {
    params.set('from', period.fromDate);
    params.set('to', period.toDate);
  }
  return params.toString();
};
