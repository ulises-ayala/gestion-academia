import type {
  ClosingChangeDto,
  ClosingFiguresDto,
  ClosingKindDto,
  CreateClosingDto,
} from '@academy/contracts';
import { Prisma } from '@academy/database';
import { DomainError } from '../../shared/domain/domain-error';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

/** Primer y último día del mes (AAAA-MM). */
export const monthRange = (month: string) => {
  const [year, value] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, value, 0)).getUTCDate();
  return { fromDate: `${month}-01`, toDate: `${month}-${String(last).padStart(2, '0')}` };
};

const validDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  datePattern.test(value) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

/**
 * Período de un cierre. Semanal: rango libre (desde/hasta) de hasta 31 días que termina ayer o
 * antes. Mensual: un mes calendario ya terminado.
 */
export const closingPeriod = (input: CreateClosingDto | null, today: string) => {
  if (input?.kind !== 'WEEKLY' && input?.kind !== 'MONTHLY')
    throw new DomainError('VALIDATION_ERROR', 'Elegí si el cierre es semanal o mensual', {
      field: 'kind',
    });
  if (input.kind === 'MONTHLY') {
    if (typeof input.month !== 'string' || !monthPattern.test(input.month))
      throw new DomainError('VALIDATION_ERROR', 'El mes no es válido', { field: 'month' });
    const range = monthRange(input.month);
    if (range.toDate >= today)
      throw new DomainError('VALIDATION_ERROR', 'El mes todavía no terminó', { field: 'month' });
    return { kind: input.kind, ...range };
  }
  if (!validDate(input.fromDate) || !validDate(input.toDate))
    throw new DomainError('VALIDATION_ERROR', 'Indicá desde y hasta qué fecha', {
      field: 'fromDate',
    });
  if (input.toDate < input.fromDate)
    throw new DomainError('VALIDATION_ERROR', 'La fecha final no puede ser anterior a la inicial', {
      field: 'toDate',
    });
  // Hasta ayer: lo que se cobre más tarde en el día aparecería como corrección posterior.
  if (input.toDate >= today)
    throw new DomainError('VALIDATION_ERROR', 'El cierre semanal llega hasta ayer como máximo', {
      field: 'toDate',
    });
  if (addDays(input.fromDate, 30) < input.toDate)
    throw new DomainError('VALIDATION_ERROR', 'Un cierre semanal abarca hasta 31 días', {
      field: 'toDate',
    });
  return { kind: input.kind, fromDate: input.fromDate, toDate: input.toDate };
};

/**
 * Próximo cierre que se propone: el semanal arranca el día siguiente al último cierre (o hace una
 * semana) y llega hasta 7 días o ayer; el mensual es el mes siguiente al último cerrado (o el mes
 * pasado). `closable` dice si ya se puede guardar.
 */
export const nextClosingPeriod = (
  kind: ClosingKindDto,
  lastToDate: string | null,
  today: string,
) => {
  if (kind === 'MONTHLY') {
    const month = lastToDate
      ? addDays(lastToDate, 1).slice(0, 7)
      : addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
    const range = monthRange(month);
    const closable = range.toDate < today;
    return { ...range, closable, reason: closable ? null : 'El mes todavía no terminó.' };
  }
  const yesterday = addDays(today, -1);
  const fromDate = lastToDate ? addDays(lastToDate, 1) : addDays(today, -7);
  const sevenDays = addDays(fromDate, 6);
  const toDate = sevenDays < yesterday ? sevenDays : yesterday;
  const closable = fromDate <= yesterday;
  return {
    fromDate,
    toDate: closable ? toDate : fromDate,
    closable,
    reason: closable ? null : 'Ya está cerrado hasta ayer.',
  };
};

/**
 * Correcciones posteriores al cierre: cada importe por concepto y medio (y las devoluciones por
 * medio) que cambió entre la foto y hoy.
 */
export const closingChanges = (
  snapshot: ClosingFiguresDto,
  current: ClosingFiguresDto,
): ClosingChangeDto[] => {
  const cells = (figures: ClosingFiguresDto) => {
    const map = new Map<
      string,
      { concept: string; label: string; method: string; amount: string }
    >();
    for (const row of figures.collections.byConceptAndMethod)
      for (const item of row.byMethod)
        map.set(`${row.concept}|${item.method}`, {
          concept: row.concept,
          label: row.label,
          method: item.method,
          amount: item.amount,
        });
    for (const item of figures.refunds.byMethod)
      map.set(`REFUNDS|${item.method}`, {
        concept: 'REFUNDS',
        label: 'Devoluciones',
        method: item.method,
        amount: item.amount,
      });
    return map;
  };
  const before = cells(snapshot);
  const after = cells(current);
  const keys = [...new Set([...before.keys(), ...after.keys()])];
  return keys
    .map((key) => {
      const original = new Prisma.Decimal(before.get(key)?.amount ?? 0);
      const now = new Prisma.Decimal(after.get(key)?.amount ?? 0);
      const cell = (after.get(key) ?? before.get(key))!;
      return {
        concept: cell.concept,
        label: cell.label,
        method: cell.method as ClosingChangeDto['method'],
        original: original.toFixed(2),
        current: now.toFixed(2),
        difference: now.minus(original).toFixed(2),
      };
    })
    .filter((change) => change.difference !== '0.00');
};
