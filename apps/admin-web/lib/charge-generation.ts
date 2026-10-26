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
