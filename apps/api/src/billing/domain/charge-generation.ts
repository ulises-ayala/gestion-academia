import type { TariffDto } from '@academy/contracts';
import { DomainError } from '../../shared/domain/domain-error';

/** Meses hacia adelante que se pueden generar para cobrar por adelantado. */
export const GENERATION_MONTHS_AHEAD = 2;
/** Día de vencimiento por defecto, el mismo que usa el alta de alumno. */
export const DEFAULT_DUE_DAY = '10';

const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export const assertGenerationPeriod = (value: unknown) => {
  if (typeof value !== 'string' || !periodPattern.test(value))
    throw new DomainError('VALIDATION_ERROR', 'El mes debe tener formato AAAA-MM', {
      field: 'period',
    });
  return value;
};

const toIndex = (period: string) =>
  Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1;
const fromIndex = (index: number) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;

export const addMonths = (period: string, months: number) => fromIndex(toIndex(period) + months);

const monthLabel = (period: string) =>
  new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${period}-01T00:00:00.000Z`),
  );

export const defaultDueDate = (period: string) => `${period}-${DEFAULT_DUE_DAY}`;

/** Máximo de meses que se generan de una vez (por ejemplo, para cargar deuda vieja). */
export const MAX_GENERATION_MONTHS = 12;

/** Meses de `from` a `until`, ambos incluidos. */
export const periodsBetween = (from: string, until: string) => {
  if (until < from)
    throw new DomainError('VALIDATION_ERROR', 'El mes final no puede ser anterior al inicial', {
      field: 'untilPeriod',
    });
  const count = toIndex(until) - toIndex(from) + 1;
  if (count > MAX_GENERATION_MONTHS)
    throw new DomainError(
      'VALIDATION_ERROR',
      `Se pueden generar hasta ${MAX_GENERATION_MONTHS} meses de una vez`,
      { field: 'untilPeriod' },
    );
  return Array.from({ length: count }, (_, index) => addMonths(from, index));
};

/**
 * Qué meses se pueden generar. Todos pueden el mes actual y hasta dos adelantados;
 * los meses anteriores (deuda vieja) quedan para quien gestiona cuotas.
 */
export const assertPeriodAllowed = (input: {
  period: string;
  currentPeriod: string;
  canBackfill: boolean;
  enrollmentStart: string;
  enrollmentEnd: string | null;
  /** Administración puede generar deuda anterior al inicio: la inscripción se adelanta. */
  allowBeforeStart?: boolean;
}) => {
  const { period, currentPeriod, canBackfill } = input;
  const latest = addMonths(currentPeriod, GENERATION_MONTHS_AHEAD);
  if (period > latest)
    throw new DomainError(
      'CHARGE_PERIOD_TOO_FAR',
      `Se puede generar hasta ${GENERATION_MONTHS_AHEAD} meses por adelantado (hasta ${monthLabel(latest)})`,
      { field: 'period' },
    );
  if (period < currentPeriod && !canBackfill)
    throw new DomainError(
      'CHARGE_PERIOD_REQUIRES_MANAGER',
      'Las cuotas de meses anteriores las genera Administración',
      { field: 'period' },
    );
  const startPeriod = input.enrollmentStart.slice(0, 7);
  if (period < startPeriod && !input.allowBeforeStart)
    throw new DomainError(
      'CHARGE_PERIOD_BEFORE_ENROLLMENT',
      `La inscripción empieza en ${monthLabel(startPeriod)}`,
      { field: 'period' },
    );
  if (input.enrollmentEnd && period > input.enrollmentEnd.slice(0, 7))
    throw new DomainError(
      'CHARGE_PERIOD_AFTER_ENROLLMENT',
      `La inscripción terminó en ${monthLabel(input.enrollmentEnd.slice(0, 7))}`,
      { field: 'period' },
    );
};

const shortDate = (value: string) =>
  `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
const tariffRange = (tariff: TariffDto) =>
  tariff.validTo
    ? `del ${shortDate(tariff.validFrom)} al ${shortDate(tariff.validTo)}`
    : `desde el ${shortDate(tariff.validFrom)}`;

const coversPeriod = (tariff: TariffDto, period: string) =>
  tariff.validFrom.slice(0, 7) <= period &&
  (!tariff.validTo || tariff.validTo.slice(0, 7) >= period);

/**
 * Tarifa de la clase para el mes. Se prefiere la activa; para meses pasados se acepta
 * la tarifa histórica inactiva de ese mes (decisión 160). Si hay más de una candidata
 * no se elige al azar: se pide revisar Tarifas.
 */
export const pickTariff = (
  tariffs: readonly TariffDto[],
  period: string,
  currentPeriod: string,
): TariffDto => {
  const covering = tariffs.filter((tariff) => coversPeriod(tariff, period));
  const active = covering.filter((tariff) => tariff.status === 'ACTIVE');
  const candidates = active.length || period >= currentPeriod ? active : covering;
  if (candidates.length === 0) {
    // Tarifas que cubren el mes pero están desactivadas: se pueden reactivar desde la ventana.
    const inactiveTariffs = covering
      .filter((tariff) => tariff.status === 'INACTIVE')
      .map(({ id, name, amount }) => ({ id, name, amount }));
    // Si la clase tiene tarifas pero ninguna cubre el mes, se dice cuál es y desde cuándo rige.
    const nearest = [...tariffs].sort((a, b) =>
      a.status === b.status
        ? b.validFrom.localeCompare(a.validFrom)
        : a.status === 'ACTIVE'
          ? -1
          : 1,
    )[0];
    throw new DomainError(
      'TARIFF_NOT_FOUND_FOR_PERIOD',
      inactiveTariffs.length
        ? `La tarifa de la clase para ${monthLabel(period)} está desactivada.`
        : nearest
          ? `La clase no tiene una tarifa para ${monthLabel(period)}: “${nearest.name}” rige ${tariffRange(nearest)}${nearest.status === 'INACTIVE' ? ' y está desactivada' : ''}. Revisá las fechas en Tarifas.`
          : `La clase no tiene ninguna tarifa cargada. Creala en Tarifas.`,
      { field: 'period', inactiveTariffs },
    );
  }
  if (candidates.length > 1)
    throw new DomainError(
      'TARIFF_AMBIGUOUS_FOR_PERIOD',
      `La clase tiene más de una tarifa vigente para ${monthLabel(period)}. Revisá Tarifas.`,
      { field: 'period' },
    );
  return candidates[0]!;
};
