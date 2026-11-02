import type { SettlementLineDto } from '@academy/contracts';
import { periodLabel } from './charge-generation';

/** Mes AAAA-MM corrido `delta` meses. */
export const shiftPeriod = (period: string, delta: number) => {
  const date = new Date(`${period}-01T12:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
};

/** Por defecto se liquida el mes anterior (el que ya terminó). */
export const defaultSettlementPeriod = (today: string) => shiftPeriod(today.slice(0, 7), -1);

export const isPeriod = (value: string | null | undefined): value is string =>
  Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));

export const settlementConceptLabel = (
  line: Pick<SettlementLineDto, 'concept' | 'chargePeriod'>,
) =>
  line.concept === 'SINGLE_CLASS'
    ? 'Clase suelta'
    : line.concept === 'HISTORICAL_DEBT'
      ? 'Deuda anterior'
      : `Cuota ${line.chargePeriod ? periodLabel(line.chargePeriod).toLowerCase() : ''}`.trim();

export type ShareRow = Readonly<{ teacherId: string; percentage: string }>;

const parsePercentage = (value: string) => {
  const text = value.trim().replace(',', '.');
  return /^\d{1,3}(\.\d{1,2})?$/.test(text) ? Number(text) : null;
};

/** Lo que queda para la academia, o null si algún porcentaje no es válido. */
export const academyShare = (rows: readonly ShareRow[]) => {
  let total = 0;
  for (const row of rows) {
    const value = parsePercentage(row.percentage);
    if (value === null) return null;
    total += value;
  }
  return Math.round((100 - total) * 100) / 100;
};

/** Mismo criterio que la API: profesor elegido, sin repetir, 0 < % ≤ 100 y total ≤ 100. */
export const sharesProblem = (rows: readonly ShareRow[]): string | null => {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.teacherId) return 'Elegí el profesor de cada fila.';
    if (seen.has(row.teacherId)) return 'Un profesor figura dos veces.';
    seen.add(row.teacherId);
    const value = parsePercentage(row.percentage);
    if (value === null || value <= 0 || value > 100)
      return 'Cada porcentaje va de 0 a 100, con hasta dos decimales.';
  }
  const rest = academyShare(rows);
  if (rest !== null && rest < 0) return 'Los porcentajes suman más de 100.';
  return null;
};

/**
 * Partes iguales entre los profesores; con la academia (Dirección) como una parte más, como en
 * la Formación Docente: 4 profesores y Dirección, 20% cada uno.
 */
export const equalShares = (teacherIds: readonly string[], withAcademy: boolean): ShareRow[] => {
  const parts = teacherIds.length + (withAcademy ? 1 : 0);
  if (teacherIds.length === 0) return [];
  const each = Math.floor(10000 / parts) / 100;
  return teacherIds.map((teacherId) => ({
    teacherId,
    percentage: String(each).replace('.', ','),
  }));
};

export const percentLabel = (value: string | number) =>
  `${Number(value).toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;
