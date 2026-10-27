import type { BillingAdjustmentTypeDto } from '@academy/contracts';

/** Igual que en la API: hasta dos meses por adelantado. */
export const GENERATION_MONTHS_AHEAD = 2;

export const businessPeriod = (now: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  })
    .format(now)
    .slice(0, 7);

export const addMonths = (period: string, months: number) => {
  const index = Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1 + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
};

/** Meses que se pueden elegir: de los anteriores solo con permiso de Administración. */
export const periodRange = (input: {
  currentPeriod: string;
  canBackfill: boolean;
  enrollmentStart: string;
}) => {
  const start = input.enrollmentStart.slice(0, 7);
  const max = addMonths(input.currentPeriod, GENERATION_MONTHS_AHEAD);
  const min = input.canBackfill ? start : start > input.currentPeriod ? start : input.currentPeriod;
  return { min, max };
};

/** Primer mes desde el actual que todavía no tiene cuota para esa inscripción. */
export const suggestedPeriod = (
  range: Readonly<{ min: string; max: string }>,
  currentPeriod: string,
  existing: ReadonlySet<string>,
) => {
  let period = range.min > currentPeriod ? range.min : currentPeriod;
  while (period <= range.max) {
    if (!existing.has(period)) return period;
    period = addMonths(period, 1);
  }
  return range.max;
};

export const defaultDueDate = (period: string) => `${period}-10`;

export type InactiveTariff = Readonly<{ id: string; name: string; amount: string }>;

/** Tarifas desactivadas que la API ofrece reactivar cuando no hay una vigente para el mes. */
export const inactiveTariffsFrom = (
  error: Readonly<{ code: string; details?: Readonly<Record<string, unknown>> }>,
): InactiveTariff[] => {
  const list = error.code === 'TARIFF_NOT_FOUND_FOR_PERIOD' ? error.details?.inactiveTariffs : null;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (item): item is InactiveTariff =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as InactiveTariff).id === 'string' &&
      typeof (item as InactiveTariff).name === 'string' &&
      typeof (item as InactiveTariff).amount === 'string',
  );
};

/** Lo que se cobra al generar y cobrar en el momento: la cuota más el recargo si ya venció. */
export const collectNowAmount = (
  preview: Readonly<{ studentDueAmount: string; lateFeeOnCollect: boolean }>,
) => {
  const cents =
    Math.round(Number(preview.studentDueAmount) * 100) + (preview.lateFeeOnCollect ? 100000 : 0);
  return (cents / 100).toFixed(2);
};

export const periodLabel = (period: string) => {
  const label = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${period}-01T00:00:00.000Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const adjustmentLabels: Readonly<Record<BillingAdjustmentTypeDto, string>> = {
  DIRECTION_SCHOLARSHIP: 'Beca Dirección',
  TEACHER_SCHOLARSHIP: 'Beca docente',
  TEACHER_DISCOUNT: 'Descuento docente',
  LATE_FEE: 'Recargo por mora',
  REVERSAL: 'Corrección',
  HISTORICAL_DISCOUNT: 'Descuento histórico',
};
