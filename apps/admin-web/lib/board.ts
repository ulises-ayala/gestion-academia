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

const niceSteps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/**
 * Eje vertical de tres marcas (piso, medio y techo) con números redondos. `fromZero` ancla el
 * piso en cero (importes acumulados); si no, el eje se ajusta al rango para que se vea la curva.
 */
export const chartScale = (values: readonly number[], fromZero: boolean) => {
  const maximum = Math.max(...values, 0);
  const minimum = fromZero ? 0 : Math.min(...values);
  const whole = values.every(Number.isInteger);
  let power = 10 ** Math.floor(Math.log10(Math.max((maximum - minimum) / 2, 1)));
  for (;;) {
    for (const factor of niceSteps) {
      const step = factor * power;
      if (whole && !Number.isInteger(step)) continue;
      const low = fromZero ? 0 : Math.floor(minimum / step) * step;
      if (low + 2 * step >= maximum)
        return { low, high: low + 2 * step, ticks: [low, low + step, low + 2 * step] };
    }
    power *= 10;
  }
};

/** Posición vertical (0 arriba, 100 abajo) de un valor dentro de la escala. */
export const chartY = (value: number, scale: Readonly<{ low: number; high: number }>) =>
  100 - ((value - scale.low) / (scale.high - scale.low)) * 100;

/** Posición horizontal (0 a 100) del punto `index` de `count`. */
export const chartX = (index: number, count: number) =>
  count <= 1 ? 50 : (index / (count - 1)) * 100;

/** Trazo SVG de una serie; los huecos (null) cortan la línea. */
export const linePath = (
  values: readonly (number | null)[],
  count: number,
  scale: Readonly<{ low: number; high: number }>,
) => {
  let path = '';
  let open = false;
  values.forEach((value, index) => {
    if (value === null) {
      open = false;
      return;
    }
    path += `${open ? 'L' : 'M'}${chartX(index, count).toFixed(2)} ${chartY(value, scale).toFixed(2)}`;
    open = true;
  });
  return path;
};

/**
 * Ritmo de cobro: lo acumulado hasta el último día cargado del mes y lo que llevaba el mes
 * anterior ese mismo día (o su cierre, si era más corto).
 */
export const paceComparison = (current: readonly string[], previous: readonly string[]) => {
  const day = current.length;
  return {
    day,
    current: Number(current.at(-1) ?? 0),
    previousSameDay: Number(previous[Math.min(day, previous.length) - 1] ?? 0),
    previousTotal: Number(previous.at(-1) ?? 0),
  };
};

/** Diferencia de participación en puntos porcentuales: "▲ 3 pts", "▼ 2 pts" o "igual". */
export const shareShift = (current: number | null, previous: number | null) => {
  if (current === null || previous === null) return null;
  const difference = current - previous;
  return difference === 0
    ? 'igual'
    : `${difference > 0 ? '▲' : '▼'} ${Math.abs(difference)} ${Math.abs(difference) === 1 ? 'pt' : 'pts'}`;
};
