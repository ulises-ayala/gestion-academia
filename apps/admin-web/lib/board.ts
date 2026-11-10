/** Mes anterior o siguiente (AAAA-MM). */
export const shiftMonth = (month: string, delta: number) => {
  const [year, value] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, value - 1 + delta, 1)).toISOString().slice(0, 7);
};

export type Delta = Readonly<{ text: string; tone: 'good' | 'bad' | 'flat' }>;

/**
 * Diferencia contra el mes anterior: "▲ 6", "▼ 2" o "Igual". `upIsGood` dice si subir es bueno
 * (alumnos, altas) o malo (bajas).
 */
export const countDelta = (current: number, previous: number, upIsGood: boolean): Delta => {
  const difference = current - previous;
  if (difference === 0) return { text: 'Igual', tone: 'flat' };
  return {
    text: `${difference > 0 ? '▲' : '▼'} ${Math.abs(difference)}`,
    tone: difference > 0 === upIsGood ? 'good' : 'bad',
  };
};

/** Variación porcentual de un importe; null si no hay con qué comparar. */
export const amountDelta = (current: string, previous: string): Delta | null => {
  const before = Number(previous);
  if (before <= 0) return null;
  const percent = ((Number(current) - before) / before) * 100;
  if (Math.abs(percent) < 0.05) return { text: 'Igual', tone: 'flat' };
  return {
    text: `${percent > 0 ? '▲' : '▼'} ${Math.abs(percent).toLocaleString('es-AR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} %`,
    tone: percent > 0 ? 'good' : 'bad',
  };
};

/** Ocupación de una clase: porcentaje del cupo y si está baja (menos del 40 %) o completa. */
export const classOccupancy = (enrolled: number, capacity: number) => {
  const percent = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
  return {
    percent,
    width: Math.min(percent, 100),
    level: capacity > 0 && percent >= 100 ? 'full' : percent < 40 ? 'low' : null,
  } as const;
};

/** Ancho de una barra (0 a 100) relativo al mayor valor; lo que no es cero se ve siempre. */
export const barWidth = (value: number, maximum: number) =>
  maximum <= 0 || value <= 0 ? 0 : Math.max(Math.round((value / maximum) * 100), 2);

/** Parte de un total, en porcentaje entero; null sin total. */
export const shareOf = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : null;
