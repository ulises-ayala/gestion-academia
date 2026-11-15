'use client';

import React, { type KeyboardEvent, type PointerEvent, useState } from 'react';
import { barWidth, chartScale, chartX, chartY, linePath } from '../../lib/board';

export type ChartSeries = Readonly<{
  name: string;
  /** `main`: la serie que importa, en el color de la marca; `muted`: la referencia, en gris. */
  tone: 'main' | 'muted';
  values: readonly (number | null)[];
}>;

const lastIndex = (values: readonly (number | null)[]) =>
  values.reduce<number>((found, value, index) => (value === null ? found : index), -1);

/**
 * Gráfico de líneas: una serie principal y, si hace falta, otra de referencia en gris. Al pasar
 * el mouse (o con las flechas del teclado) muestra los valores de ese punto.
 */
export function LineChart({
  series,
  labels,
  ticks,
  format,
  fromZero = false,
  reference,
  summary,
}: Readonly<{
  series: readonly ChartSeries[];
  /** Nombre completo de cada punto, para el detalle. */
  labels: readonly string[];
  /** Puntos que llevan etiqueta en el eje horizontal. */
  ticks: readonly Readonly<{ index: number; label: string }>[];
  format(value: number): string;
  /** Importes acumulados: el eje arranca en cero y la serie principal lleva relleno. */
  fromZero?: boolean;
  reference?: Readonly<{ value: number; label: string }> | undefined;
  summary: string;
}>) {
  const [active, setActive] = useState<number | null>(null);
  const count = labels.length;
  const values = series.flatMap((one) => one.values.filter((value) => value !== null));
  if (reference) values.push(reference.value);
  if (count === 0 || values.length === 0 || Math.max(...values) === 0)
    return <p className="board-empty">Todavía no hay datos para graficar.</p>;
  const scale = chartScale(values, fromZero);
  // La principal se dibuja última, arriba de la referencia.
  const ordered = [
    ...series.filter((one) => one.tone === 'muted'),
    ...series.filter((one) => one.tone === 'main'),
  ];
  const main = series.find((one) => one.tone === 'main');
  const mainEnd = main ? lastIndex(main.values) : -1;

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = box.width > 0 ? (event.clientX - box.left) / box.width : 0;
    setActive(Math.min(Math.max(Math.round(ratio * (count - 1)), 0), count - 1));
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = active ?? (mainEnd >= 0 ? mainEnd : count - 1);
    const next =
      event.key === 'ArrowLeft'
        ? from - 1
        : event.key === 'ArrowRight'
          ? from + 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : null;
    if (event.key === 'Escape') setActive(null);
    if (next === null) return;
    event.preventDefault();
    setActive(Math.min(Math.max(next, 0), count - 1));
  };
  const activeX = active === null ? 0 : chartX(active, count);

  return (
    <figure className="board-chart">
      <div aria-hidden="true" className="board-chart-axis">
        {[...scale.ticks].reverse().map((tick) => (
          <span key={tick}>{format(tick)}</span>
        ))}
      </div>
      <div
        aria-label={`${summary} Con las flechas se recorre punto por punto.`}
        className="board-chart-plot"
        onBlur={() => setActive(null)}
        onKeyDown={key}
        onPointerLeave={() => setActive(null)}
        onPointerMove={move}
        role="group"
        tabIndex={0}
      >
        <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
          {[0, 50, 100].map((y) => (
            <line className="board-chart-grid" key={y} x1="0" x2="100" y1={y} y2={y} />
          ))}
          {reference && (
            <line
              className="board-chart-reference"
              x1="0"
              x2="100"
              y1={chartY(reference.value, scale)}
              y2={chartY(reference.value, scale)}
            />
          )}
          {fromZero && main && mainEnd > 0 && (
            <path
              className="board-chart-area"
              d={`${linePath(main.values.slice(0, mainEnd + 1), count, scale)}L${chartX(mainEnd, count).toFixed(2)} 100L0 100Z`}
            />
          )}
          {ordered.map((one) => (
            <path
              className={`board-chart-line is-${one.tone}`}
              d={linePath(one.values, count, scale)}
              key={one.name}
            />
          ))}
        </svg>
        {reference && (
          <span
            className="board-chart-reference-label"
            style={{ top: `${chartY(reference.value, scale)}%` }}
          >
            {reference.label}
          </span>
        )}
        {main && mainEnd >= 0 && active === null && (
          <i
            className="board-chart-dot is-main"
            style={{
              left: `${chartX(mainEnd, count)}%`,
              top: `${chartY(main.values[mainEnd]!, scale)}%`,
            }}
          />
        )}
        {active !== null && (
          <>
            <i className="board-chart-cross" style={{ left: `${activeX}%` }} />
            {ordered.map((one) => {
              const value = one.values[active];
              return value === null || value === undefined ? null : (
                <i
                  className={`board-chart-dot is-${one.tone}`}
                  key={one.name}
                  style={{ left: `${activeX}%`, top: `${chartY(value, scale)}%` }}
                />
              );
            })}
          </>
        )}
        <div
          aria-live="polite"
          className={`board-chart-tip${activeX > 60 ? ' is-left' : ''}`}
          hidden={active === null}
          style={{ left: `${activeX}%` }}
        >
          {active !== null && (
            <>
              <b>{labels[active]}</b>
              {series.map((one) => {
                const value = one.values[active];
                return value === null || value === undefined ? null : (
                  <span key={one.name}>
                    <i className={`is-${one.tone}`} />
                    {one.name} <strong>{format(value)}</strong>
                  </span>
                );
              })}
            </>
          )}
        </div>
      </div>
      <div aria-hidden="true" className="board-chart-x">
        {ticks.map((tick) => (
          <span
            className={tick.index === 0 ? 'is-first' : tick.index === count - 1 ? 'is-last' : ''}
            key={tick.index}
            style={{ left: `${chartX(tick.index, count)}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      {series.length > 1 && (
        <figcaption className="board-legend">
          {series.map((one) => (
            <span key={one.name}>
              <i className={`board-legend-line is-${one.tone}`} />
              {one.name}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}

/** Mini tendencia de una tarjeta: solo la forma, sin ejes; el último punto resaltado. */
export function Sparkline({ values }: Readonly<{ values: readonly number[] }>) {
  if (values.length < 2 || Math.max(...values) === Math.min(...values)) return null;
  const scale = { low: Math.min(...values), high: Math.max(...values) };
  return (
    <span aria-hidden="true" className="board-spark">
      <svg preserveAspectRatio="none" viewBox="0 0 100 100">
        <path className="board-chart-line is-muted" d={linePath(values, values.length, scale)} />
      </svg>
      <i className="board-chart-dot is-main" style={{ top: `${chartY(values.at(-1)!, scale)}%` }} />
    </span>
  );
}

/**
 * Altas hacia arriba y bajas hacia abajo de una misma línea, con el neto del mes: se ve de un
 * vistazo si la academia creció o se achicó.
 */
export function DivergingColumns({
  items,
  summary,
}: Readonly<{
  items: readonly Readonly<{
    key: string;
    label: string;
    title: string;
    up: number;
    down: number;
  }>[];
  summary: string;
}>) {
  const maximum = Math.max(...items.flatMap((item) => [item.up, item.down]), 0);
  if (maximum === 0) return <p className="board-empty">Todavía no hay datos en estos meses.</p>;
  return (
    <>
      <div aria-label={summary} className="board-diverging" role="img">
        {items.map((item, index) => {
          const net = item.up - item.down;
          return (
            <div
              className={`board-diverging-column${index === items.length - 1 ? ' is-current' : ''}`}
              key={item.key}
              title={`${item.title}: ${item.up} altas, ${item.down} bajas, neto ${net > 0 ? '+' : ''}${net}`}
            >
              <div className="board-diverging-up">
                <span>{item.up}</span>
                <i className="is-in" style={{ height: `${barWidth(item.up, maximum)}%` }} />
              </div>
              <div className="board-diverging-down">
                <i className="is-out" style={{ height: `${barWidth(item.down, maximum)}%` }} />
                <span>{item.down}</span>
              </div>
              <span className="board-diverging-month">{item.label}</span>
              <b className={net > 0 ? 'is-good' : net < 0 ? 'is-bad' : ''}>
                {net > 0 ? '+' : net < 0 ? '−' : ''}
                {Math.abs(net)}
              </b>
            </div>
          );
        })}
      </div>
      <div className="board-legend">
        <span>
          <i className="is-in" />
          Altas
        </span>
        <span>
          <i className="is-out" />
          Bajas
        </span>
        <span>Abajo de cada mes, el neto</span>
      </div>
    </>
  );
}

/** Barra fina partida por medio de pago; los importes van en la lista de al lado. */
export function SegmentBar({
  label,
  segments,
  thin = false,
}: Readonly<{
  label: string;
  segments: readonly Readonly<{ key: string; value: number }>[];
  thin?: boolean;
}>) {
  return (
    <div className={`board-segments${thin ? ' is-thin' : ''}`}>
      <span>{label}</span>
      <div>
        {segments.map(
          (segment) =>
            segment.value > 0 && (
              <i data-method={segment.key} key={segment.key} style={{ flexGrow: segment.value }} />
            ),
        )}
      </div>
    </div>
  );
}
