import type {
  ClosingFiguresDto,
  ClosingHandoversDto,
  ClosingKindDto,
  CreateClosingDto,
} from '@academy/contracts';
import { periodLabel } from './charge-generation';
import { monthName } from './charge-grid';
import { dayMonth, dayMonthYear } from './dates';
import { money } from './money';
import { paymentMethodLabels } from './payments';

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

/** "1.º corte de noviembre": el número lo da la API (cierres semanales que arrancan en el mes). */
export const closingCutLabel = (fromDate: string, sequence: number | null) =>
  sequence ? `${sequence}.º corte de ${monthName(fromDate).toLowerCase()}` : null;

/** "$850.000" o "$41.684,04": sin espacios ni centavos en cero, como en un mensaje. */
const plainMoney = (value: string) => money(value).replace(/\s/g, '').replace(/,00$/, '');

export type ClosingSummaryInput = Readonly<{
  kind: ClosingKindDto;
  fromDate: string;
  toDate: string;
  sequence: number | null;
  figures: ClosingFiguresDto;
  handovers: ClosingHandoversDto;
}>;

/**
 * Resumen del cierre para mandarle a Dirección por WhatsApp: ingresos por concepto y por medio,
 * total y efectivo entregado, como la planilla que se armaba a mano.
 */
export const closingSummaryText = (closing: ClosingSummaryInput) => {
  const { collections, refunds } = closing.figures;
  const { handovers } = closing;
  const period =
    closing.kind === 'MONTHLY'
      ? periodLabel(closing.fromDate.slice(0, 7))
      : `${dayMonth(closing.fromDate)} al ${dayMonthYear(closing.toDate)}`;
  const title =
    closing.kind === 'MONTHLY'
      ? 'CIERRE MENSUAL'
      : closing.sequence
        ? `${closing.sequence}.º CORTE – ${monthName(closing.fromDate).toUpperCase()}`
        : 'CORTE SEMANAL';
  const lines = [
    '*CARMESÍ – RESUMEN DE INGRESOS*',
    `*Período: ${period}*`,
    title,
    '',
    'INGRESOS POR CONCEPTO',
    ...collections.byConceptAndMethod.map((row) => `• ${row.label}: ${plainMoney(row.total)}`),
    '',
    'INGRESOS POR MEDIO DE PAGO',
    ...collections.byMethod
      .filter((item) => Number(item.amount) !== 0)
      .map((item) => `• ${paymentMethodLabels[item.method]}: ${plainMoney(item.amount)}`),
    '',
    `*TOTAL RECAUDADO: ${plainMoney(collections.total)}*`,
  ];
  if (Number(refunds.total) > 0)
    lines.push('', `Devoluciones de saldo a favor: ${plainMoney(refunds.total)}`);
  if (handovers.items.length > 0) {
    lines.push(
      '',
      'EFECTIVO ENTREGADO',
      ...handovers.items.map(
        (item) =>
          `• Del ${dayMonth(item.fromDate)} al ${dayMonth(item.toDate)}: ${plainMoney(item.amount)} (recibió ${item.receivedBy})`,
      ),
    );
    const difference = Number(handovers.difference);
    if (difference !== 0)
      lines.push(
        `${difference < 0 ? 'Falta entregar' : 'Entregado de más'}: ${plainMoney(String(Math.abs(difference)))}`,
      );
  }
  lines.push(
    '',
    `Movimientos registrados del ${dayMonthYear(closing.fromDate)} al ${dayMonthYear(closing.toDate)}.`,
  );
  return lines.join('\n');
};

/** WhatsApp con el resumen cargado, para elegir a quién mandarlo. */
export const closingSummaryUrl = (text: string) =>
  `https://wa.me/?text=${encodeURIComponent(text)}`;
