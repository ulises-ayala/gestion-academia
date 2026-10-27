import type { BillingAdjustmentTypeDto, TariffDto } from '@academy/contracts';

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

/** Hasta cuántos meses hacia atrás Administración puede cargar deuda desde la ventana. */
export const GENERATION_MONTHS_BACK = 12;

/**
 * Meses que se pueden elegir. Admisión: desde el mes actual (o el inicio de la inscripción).
 * Administración: también deuda anterior, aunque sea previa al inicio (la inscripción se adelanta).
 */
export const periodRange = (input: {
  currentPeriod: string;
  canBackfill: boolean;
  enrollmentStart: string;
}) => {
  const start = input.enrollmentStart.slice(0, 7);
  const max = addMonths(input.currentPeriod, GENERATION_MONTHS_AHEAD);
  const min = input.canBackfill
    ? addMonths(input.currentPeriod, -GENERATION_MONTHS_BACK)
    : start > input.currentPeriod
      ? start
      : input.currentPeriod;
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

export type TariffDraft = { name: string; amount: string; validFrom: string; validTo: string };

const dayBefore = (date: string) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
};

/**
 * Propuesta de tarifa nueva para cubrir el mes: copia nombre e importe de la tarifa más
 * reciente de la clase y, si hay una activa que empieza después, termina el día anterior
 * para no superponerse.
 */
export const tariffDraft = (
  classTariffs: readonly TariffDto[],
  period: string,
  className: string,
): TariffDraft => {
  const validFrom = `${period}-01`;
  const base = [...classTariffs].sort((a, b) =>
    a.status === b.status ? b.validFrom.localeCompare(a.validFrom) : a.status === 'ACTIVE' ? -1 : 1,
  )[0];
  const next = classTariffs
    .filter((tariff) => tariff.status === 'ACTIVE' && tariff.validFrom > validFrom)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0];
  return {
    name: base?.name ?? `${className} mensual`,
    amount: base?.amount ?? '',
    validFrom,
    validTo: next ? dayBefore(next.validFrom) : '',
  };
};

/** Tarifa activa de la clase cuyas fechas se pisan con las propuestas. */
export const overlappingTariff = (
  classTariffs: readonly TariffDto[],
  range: Readonly<{ validFrom: string; validTo: string }>,
) =>
  classTariffs.find(
    (tariff) =>
      tariff.status === 'ACTIVE' &&
      (!range.validTo || tariff.validFrom <= range.validTo) &&
      (!tariff.validTo || !range.validFrom || tariff.validTo >= range.validFrom),
  ) ?? null;

export const formatTariffRange = (
  tariff: Readonly<{ validFrom: string; validTo: string | null }>,
) => {
  const date = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
  return tariff.validTo
    ? `del ${date(tariff.validFrom)} al ${date(tariff.validTo)}`
    : `desde el ${date(tariff.validFrom)}`;
};

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

/** Lo que se cobra al generar y cobrar en el momento: las cuotas más un recargo por cada vencida. */
export const collectNowAmount = (preview: Readonly<{ newTotal: string; lateFeeCount: number }>) => {
  const cents = Math.round(Number(preview.newTotal) * 100) + preview.lateFeeCount * 100000;
  return (cents / 100).toFixed(2);
};

export const shortDate = (value: string) =>
  `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;

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
