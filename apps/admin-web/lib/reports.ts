export const reportTabs = [
  ['summary', 'Resumen'],
  ['students', 'Alumnos'],
  ['collections', 'Cobros'],
  ['teachers', 'Profesores'],
  ['debtors', 'Deudores'],
  ['attendance', 'Asistencia'],
  ['cash', 'Caja'],
] as const;
export type ReportTab = (typeof reportTabs)[number][0];

/** Pestaña de la URL; los enlaces viejos a "Cobros y deuda" siguen abriendo Cobros. */
export const reportTab = (value: string | null): ReportTab =>
  reportTabs.some(([key]) => key === value) ? (value as ReportTab) : 'summary';

const DAY = 86_400_000;
const time = (date: string) => Date.parse(`${date}T00:00:00.000Z`);

/**
 * Cobros por día con los días sin cobros en cero, para que el gráfico sea una línea de tiempo.
 * En períodos de más de 62 días se muestran solo los días con cobros.
 */
export const dailySeries = (
  from: string,
  to: string,
  byDay: readonly Readonly<{ date: string; amount: string }>[],
) => {
  const days = Math.round((time(to) - time(from)) / DAY) + 1;
  if (!(days > 0) || days > 62)
    return byDay.map((item) => ({ date: item.date, amount: Number(item.amount) }));
  const amounts = new Map(byDay.map((item) => [item.date.slice(0, 10), Number(item.amount)]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(time(from) + index * DAY).toISOString().slice(0, 10);
    return { date, amount: amounts.get(date) ?? 0 };
  });
};

/** Cada cuántas columnas se rotula el día para que las fechas no se pisen. */
export const dayLabelStep = (count: number) => Math.max(1, Math.ceil(count / 16));
