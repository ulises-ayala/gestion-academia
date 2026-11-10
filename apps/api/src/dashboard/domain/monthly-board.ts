import { DomainError } from '../../shared/domain/domain-error';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const fullMonths = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const END_REASON_LABELS: Readonly<Record<string, string>> = {
  NO_LONGER_ATTENDING: 'Dejó la actividad',
  SCHEDULE_CHANGE: 'Cambio de horario',
  DISCIPLINE_CHANGE: 'Cambio de disciplina',
  PERSONAL_REASONS: 'Motivos personales',
  NON_PAYMENT: 'Morosidad',
  OTHER: 'Otro',
  UNSPECIFIED: 'Sin motivo cargado',
};

/** Mes del tablero (AAAA-MM): el pedido o el actual; nunca uno futuro. */
export const boardMonth = (value: string | undefined, today: string) => {
  const current = today.slice(0, 7);
  if (value === undefined || value === '') return current;
  if (!monthPattern.test(value))
    throw new DomainError('VALIDATION_ERROR', 'El mes no es válido', { field: 'month' });
  if (value > current)
    throw new DomainError('VALIDATION_ERROR', 'El mes todavía no empezó', { field: 'month' });
  return value;
};

export type BoardMonth = Readonly<{
  month: string;
  label: string;
  shortLabel: string;
  fromDate: string;
  toDate: string;
  /** Día en que se cuentan los alumnos activos: fin de mes o, si no terminó, hoy. */
  refDate: string;
  /** Primer día del mes siguiente. */
  nextDate: string;
}>;

/** Los `count` meses que terminan en `month`, del más viejo al más nuevo. */
export const boardMonths = (month: string, today: string, count = 6): BoardMonth[] => {
  const [year, value] = month.split('-').map(Number) as [number, number];
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return Array.from({ length: count }, (_, index) => {
    const first = new Date(Date.UTC(year, value - 1 - (count - 1 - index), 1));
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
    const last = iso(new Date(next.getTime() - 86_400_000));
    const name = fullMonths[first.getUTCMonth()]!;
    return {
      month: iso(first).slice(0, 7),
      label: `${name} ${first.getUTCFullYear()}`,
      shortLabel: name.slice(0, 3),
      fromDate: iso(first),
      toDate: last,
      refDate: last < today ? last : today,
      nextDate: iso(next),
    };
  });
};

/** Porcentaje entero de `part` sobre `total`; null si no hay total. */
export const percentOf = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : null;
