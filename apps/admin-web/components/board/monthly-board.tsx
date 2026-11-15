import type { MonthlyBoardDto } from '@academy/contracts';
import Link from 'next/link';
import React, { type ReactNode } from 'react';
import {
  type Delta,
  amountDelta,
  barWidth,
  classOccupancy,
  countDelta,
  paceComparison,
  shareOf,
  shareShift,
} from '../../lib/board';
import { DivergingColumns, LineChart, SegmentBar, Sparkline } from './charts';
import { compactMoney } from '../../lib/money';

type History = MonthlyBoardDto['history'][number];
const monthName = (label: string) => label.split(' ')[0]!.toLowerCase();
/** "Nov 25": el mes corto con el año, para el eje de los gráficos. */
const axisMonth = (item: History) => `${item.shortLabel} ${item.month.slice(2, 4)}`;
const amount = (value: string | undefined) => compactMoney(Number(value ?? 0));

export function Kpi({
  label,
  value,
  delta,
  note,
  trend,
  yearAgo,
}: Readonly<{
  label: string;
  value: ReactNode;
  delta?: Delta | null;
  note: string;
  /** Valores mes a mes hasta el consultado, para la mini tendencia. */
  trend?: readonly number[];
  /** El mismo mes del año anterior, ya formateado. */
  yearAgo?: string | null | undefined;
}>) {
  return (
    <div className="board-kpi">
      <span>{label}</span>
      <div className="board-kpi-figure">
        <strong>{value}</strong>
        {trend && <Sparkline values={trend} />}
      </div>
      <p className={`board-delta${delta ? ` is-${delta.tone}` : ''}`}>
        {delta && <b>{delta.text}</b>} {note}
      </p>
      {yearAgo && <p className="board-delta">Hace un año: {yearAgo}</p>}
    </div>
  );
}

function Card({
  title,
  description,
  className = '',
  children,
}: Readonly<{ title: string; description: string; className?: string; children: ReactNode }>) {
  return (
    <section className={`board-card ${className}`.trim()}>
      <h2>{title}</h2>
      <p className="board-card-copy">{description}</p>
      {children}
    </section>
  );
}

/** Barras horizontales con el nombre y el valor a la vista. */
export function Bars({
  items,
  empty,
}: Readonly<{
  items: readonly Readonly<{ key: string; label: string; value: number; text: string }>[];
  empty: string;
}>) {
  const maximum = Math.max(...items.map((item) => item.value), 0);
  if (maximum === 0) return <p className="board-empty">{empty}</p>;
  return (
    <ul className="board-bars">
      {items.map((item) => (
        <li key={item.key}>
          <b>{item.label}</b>
          <em>{item.text}</em>
          <div className="board-track">
            <i style={{ width: `${barWidth(item.value, maximum)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tablero de un mes: los importes se muestran solo si vinieron (`data.money`). */
export function MonthlyBoard({ data }: Readonly<{ data: MonthlyBoardDto }>) {
  const current = data.history.at(-1)!;
  const previous = data.history.at(-2)!;
  const { money, leads } = data;
  const against = `vs. ${monthName(previous.label)}`;
  // Los meses sin ningún dato del principio (antes de usar el sistema) no se grafican.
  const firstWithData = data.history.findIndex(
    (item) => item.activeStudents > 0 || item.newStudents > 0 || Number(item.collected ?? 0) > 0,
  );
  const shown = data.history.slice(
    Math.min(firstWithData < 0 ? data.history.length : firstWithData, data.history.length - 2),
  );
  const yearAgo = data.history.length === 13 && firstWithData === 0 ? data.history[0]! : null;
  const monthTicks = shown.flatMap((item, index) =>
    (shown.length - 1 - index) % (shown.length > 7 ? 3 : 1) === 0
      ? [{ index, label: axisMonth(item) }]
      : [],
  );
  // En el detalle de los gráficos, el mes que no terminó lo dice.
  const monthLabels = shown.map((item) =>
    item === current && data.inProgress ? `${item.label} (en curso)` : item.label,
  );
  const spanLabel = shown.length >= 12 ? 'último año' : `últimos ${shown.length} meses`;
  const pace = money ? paceComparison(money.pace.current, money.pace.previous) : null;
  const paceDays = money ? Math.max(money.pace.current.length, money.pace.previous.length) : 0;
  const earlier = shown.slice(0, -1).map((item) => Number(item.collected ?? 0));
  const average = earlier.length ? earlier.reduce((sum, one) => sum + one, 0) / earlier.length : 0;
  const previousCollected = Number(previous.collected ?? 0);
  const charges = money?.charges;
  const chargesTotal = Number(charges?.total ?? 0);
  const paidShare = charges ? shareOf(Number(charges.paidAmount), chargesTotal) : null;
  const collectedTotal = Number(current.collected ?? 0);
  const leadRate = shareOf(leads.enrolled, leads.inquiries);
  const previousLeadRate = shareOf(leads.previousEnrolled, leads.previousInquiries);
  const lowClasses = data.classes.filter(
    (item) => classOccupancy(item.enrolled, item.capacity).level === 'low',
  ).length;

  return (
    <>
      <section aria-label="Resumen del mes" className="board-kpis">
        <Kpi
          delta={countDelta(current.activeStudents, previous.activeStudents, true)}
          label="Alumnos activos"
          note={against}
          trend={shown.map((item) => item.activeStudents)}
          value={current.activeStudents}
          yearAgo={yearAgo && String(yearAgo.activeStudents)}
        />
        <Kpi
          delta={countDelta(current.newStudents, previous.newStudents, true)}
          label="Altas"
          note={against}
          trend={shown.map((item) => item.newStudents)}
          value={current.newStudents}
        />
        <Kpi
          delta={countDelta(current.dropped, previous.dropped, false)}
          label="Bajas"
          note={against}
          trend={shown.map((item) => item.dropped)}
          value={current.dropped}
        />
        {money ? (
          <>
            <Kpi
              delta={amountDelta(current.collected ?? '0', previous.collected ?? '0')}
              label="Recaudado"
              note={against}
              trend={shown.map((item) => Number(item.collected ?? 0))}
              value={amount(current.collected)}
              yearAgo={yearAgo && amount(yearAgo.collected)}
            />
            <Kpi
              label="Deuda vencida hoy"
              note={`${data.overdueStudents} ${data.overdueStudents === 1 ? 'alumno' : 'alumnos'}`}
              value={amount(money.overdueDebt)}
            />
          </>
        ) : (
          <Kpi
            label="Alumnos con cuotas vencidas"
            note="al día de hoy"
            value={data.overdueStudents}
          />
        )}
      </section>

      <div className="board-grid">
        {money && pace && (
          <Card
            className="board-span-7"
            description={`Lo cobrado acumulado día por día, contra ${monthName(previous.label)}.`}
            title="Ritmo de cobro"
          >
            <p className="board-hero">
              <strong>{compactMoney(pace.current)}</strong>
              <span>{data.inProgress ? `cobrado al día ${pace.day}` : 'cobrado en el mes'}</span>
            </p>
            <p className="board-pace-note">
              {(() => {
                const delta = amountDelta(String(pace.current), String(pace.previousSameDay));
                return delta ? (
                  <span className={`board-delta is-${delta.tone}`}>
                    <b>{delta.text}</b> vs. {monthName(previous.label)}
                    {data.inProgress ? ' al mismo día' : ''} ({compactMoney(pace.previousSameDay)}).
                  </span>
                ) : (
                  <span className="board-delta">
                    En {monthName(previous.label)} no había cobros{' '}
                    {data.inProgress ? 'a esta altura' : ''} para comparar.
                  </span>
                );
              })()}
              {data.inProgress && pace.previousTotal > 0 && (
                <span className="board-delta">
                  {' '}
                  {previous.label.split(' ')[0]} cerró en {compactMoney(pace.previousTotal)}.
                </span>
              )}
            </p>
            <LineChart
              format={compactMoney}
              fromZero
              labels={Array.from({ length: paceDays }, (_, index) => `Día ${index + 1}`)}
              series={[
                {
                  name: data.label.split(' ')[0]!,
                  tone: 'main',
                  values: Array.from({ length: paceDays }, (_, index) =>
                    index < money.pace.current.length ? Number(money.pace.current[index]) : null,
                  ),
                },
                {
                  name: previous.label.split(' ')[0]!,
                  tone: 'muted',
                  values: Array.from({ length: paceDays }, (_, index) =>
                    index < money.pace.previous.length ? Number(money.pace.previous[index]) : null,
                  ),
                },
              ]}
              summary={`Cobrado acumulado por día: ${data.label} lleva ${compactMoney(pace.current)} al día ${pace.day}; ${previous.label} llevaba ${compactMoney(pace.previousSameDay)}.`}
              ticks={[1, 5, 10, 15, 20, 25, 30]
                .filter((day) => day <= paceDays)
                .map((day) => ({ index: day - 1, label: String(day) }))}
            />
          </Card>
        )}

        {charges && (
          <Card
            className="board-span-5"
            description="Cuánto de lo que había que cobrar por las cuotas de este mes ya entró."
            title={`Cobranza de las cuotas de ${monthName(data.label)}`}
          >
            {chargesTotal === 0 ? (
              <p className="board-empty">No hay cuotas generadas para este mes.</p>
            ) : (
              <>
                <p className="board-hero">
                  <strong>{paidShare} %</strong>
                  <span>
                    cobrado · {amount(charges.paidAmount)} de {amount(charges.total)}
                  </span>
                </p>
                <div
                  aria-label={`${paidShare} % cobrado, ${amount(charges.openAmount)} pendiente sin vencer y ${amount(charges.overdueAmount)} vencido`}
                  className="board-meter"
                  role="img"
                >
                  {(
                    [
                      ['is-paid', charges.paidAmount],
                      ['is-open', charges.openAmount],
                      ['is-late', charges.overdueAmount],
                    ] as const
                  ).map(
                    ([name, value]) =>
                      Number(value) > 0 && (
                        <i className={name} key={name} style={{ flexGrow: Number(value) }} />
                      ),
                  )}
                </div>
                <dl className="board-meter-legend">
                  <div>
                    <dt>
                      <i className="is-paid" />
                      Cobrado
                    </dt>
                    <dd>
                      {amount(charges.paidAmount)}{' '}
                      <small>{charges.paidCount} cuotas completas</small>
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <i className="is-open" />
                      Pendiente sin vencer
                    </dt>
                    <dd>
                      {amount(charges.openAmount)} <small>{charges.openCount} cuotas</small>
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <i className="is-late" />
                      Vencido
                    </dt>
                    <dd>
                      {amount(charges.overdueAmount)} <small>{charges.overdueCount} cuotas</small>
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </Card>
        )}

        {money && (
          <>
            <Card
              className="board-span-7"
              description={`Todo lo cobrado por mes, ${spanLabel}. La línea punteada es el promedio de los meses anteriores.`}
              title="Recaudación por mes"
            >
              <LineChart
                format={compactMoney}
                fromZero
                labels={monthLabels}
                reference={
                  average > 0
                    ? { value: average, label: `Promedio ${compactMoney(average)}` }
                    : undefined
                }
                series={[
                  {
                    name: 'Recaudado',
                    tone: 'main',
                    values: shown.map((item) => Number(item.collected ?? 0)),
                  },
                ]}
                summary={`Recaudación por mes, ${spanLabel}; ${current.label}: ${amount(current.collected)}.`}
                ticks={monthTicks}
              />
            </Card>
            <Card
              className="board-span-5"
              description={`Cómo pagaron en el mes y cómo cambió contra ${monthName(previous.label)}.`}
              title="Por medio de pago"
            >
              {money.byMethod.length === 0 ? (
                <p className="board-empty">No hubo cobros este mes ni el anterior.</p>
              ) : (
                <>
                  <SegmentBar
                    label={current.shortLabel}
                    segments={money.byMethod.map((item) => ({
                      key: item.method,
                      value: Number(item.amount),
                    }))}
                  />
                  {previousCollected > 0 && (
                    <SegmentBar
                      label={previous.shortLabel}
                      segments={money.byMethod.map((item) => ({
                        key: item.method,
                        value: Number(item.previousAmount),
                      }))}
                      thin
                    />
                  )}
                  <ul className="board-methods">
                    {money.byMethod.map((item) => {
                      const share = shareOf(Number(item.amount), collectedTotal);
                      const shift = shareShift(
                        share,
                        shareOf(Number(item.previousAmount), previousCollected),
                      );
                      return (
                        <li key={item.method}>
                          <i data-method={item.method} />
                          <b>{item.label}</b>
                          <em>
                            {amount(item.amount)} · {share ?? 0} %
                          </em>
                          {shift && (
                            <small>
                              {shift} vs. {monthName(previous.label)}
                            </small>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Card>
          </>
        )}

        <Card
          className="board-span-7"
          description={`Alumnos con una inscripción vigente al cierre de cada mes, ${spanLabel}.`}
          title="Alumnos activos"
        >
          <LineChart
            format={String}
            labels={monthLabels}
            series={[
              {
                name: 'Alumnos activos',
                tone: 'main',
                values: shown.map((item) => item.activeStudents),
              },
            ]}
            summary={`Alumnos activos por mes, ${spanLabel}; ${current.label}: ${current.activeStudents}.`}
            ticks={monthTicks}
          />
        </Card>

        <Card
          className="board-span-5"
          description="Los que empezaron, hacia arriba; los que dejaron, hacia abajo. Últimos 6 meses."
          title="Altas y bajas"
        >
          <DivergingColumns
            items={shown.slice(-6).map((item) => ({
              key: item.month,
              label: item.shortLabel,
              title: item.label,
              up: item.newStudents,
              down: item.dropped,
            }))}
            summary={`Altas y bajas de los últimos meses; ${current.label}: ${current.newStudents} altas y ${current.dropped} bajas.`}
          />
        </Card>

        <Card
          className="board-span-4"
          description={`Motivo de las bajas de ${monthName(data.label)}.`}
          title="Por qué se van"
        >
          <Bars
            empty="No hubo bajas este mes."
            items={data.dropReasons.map((item) => ({
              key: item.reason,
              label: item.label,
              value: item.count,
              text: String(item.count),
            }))}
          />
        </Card>

        <Card
          className="board-span-12"
          description={`Ocupación y asistencia de cada clase activa${money ? ', con lo cobrado en el mes y lo vencido hoy' : ''}. De menor a mayor ocupación.`}
          title="Clases"
        >
          {data.classes.length === 0 ? (
            <p className="board-empty">No hay clases activas.</p>
          ) : (
            <div className="board-table-wrap">
              <table className="board-table">
                <thead>
                  <tr>
                    <th scope="col">Clase</th>
                    <th scope="col">Ocupación</th>
                    <th className="is-number" scope="col">
                      Altas / bajas
                    </th>
                    <th className="is-number" scope="col">
                      Asistencia
                    </th>
                    {money && (
                      <>
                        <th className="is-number" scope="col">
                          Recaudado
                        </th>
                        <th className="is-number" scope="col">
                          Vencido
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.classes.map((item) => {
                    const occupancy = classOccupancy(item.enrolled, item.capacity);
                    return (
                      <tr key={item.id}>
                        <td>
                          <Link className="text-link" href={`/classes/${item.id}`}>
                            {item.name}
                          </Link>
                          <small>{item.teacher}</small>
                        </td>
                        <td>
                          <div className="board-occupancy">
                            <span>
                              {item.enrolled} de {item.capacity}
                              {occupancy.level && (
                                <span className={`board-flag is-${occupancy.level}`}>
                                  {occupancy.level === 'low' ? 'Baja' : 'Completa'}
                                </span>
                              )}
                            </span>
                            <div className="board-track">
                              <i style={{ width: `${occupancy.width}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="is-number">
                          +{item.started} / −{item.ended}
                        </td>
                        <td className="is-number">
                          {item.attendancePercent === null ? '—' : `${item.attendancePercent} %`}
                        </td>
                        {money && (
                          <>
                            <td className="is-number">{amount(item.collected)}</td>
                            <td className="is-number">{amount(item.overdue)}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {money && (
          <>
            <Card
              className="board-span-4"
              description="De dónde vino la plata."
              title="Por concepto"
            >
              <Bars
                empty="No hubo cobros este mes."
                items={money.byConcept.map((item) => ({
                  key: item.key,
                  label: item.label,
                  value: Number(item.amount),
                  text: `${amount(item.amount)} · ${shareOf(Number(item.amount), collectedTotal) ?? 0} %`,
                }))}
              />
            </Card>
          </>
        )}

        <Card
          className="board-span-4"
          description="De las consultas cargadas en el mes, cuántas llegaron a inscribirse."
          title="Potenciales alumnos"
        >
          {leads.inquiries === 0 ? (
            <p className="board-empty">No se cargaron consultas este mes.</p>
          ) : (
            <>
              <div className="board-funnel">
                {(
                  [
                    ['Consultas', leads.inquiries],
                    ['Clase de prueba', leads.trials],
                    ['Inscriptos', leads.enrolled],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <i style={{ width: `${barWidth(value, leads.inquiries)}%` }} />
                    <em>{value}</em>
                  </div>
                ))}
              </div>
              <p className="board-note">
                Se inscribió el {leadRate} % de las consultas.
                {previousLeadRate !== null && ` El mes anterior, ${previousLeadRate} %.`}
              </p>
            </>
          )}
        </Card>

        {!money && (
          <Card
            className="board-span-4"
            description="Lo que este tablero deja a la vista."
            title="Para hacer"
          >
            <ul className="board-todo">
              <li>
                <Link className="text-link" href="/payments">
                  Avisar a alumnos con cuotas vencidas
                </Link>
                <em>{data.overdueStudents}</em>
              </li>
              <li>
                <Link className="text-link" href="/leads">
                  Seguir a potenciales que no se inscribieron
                </Link>
                <em>{Math.max(leads.inquiries - leads.enrolled, 0)}</em>
              </li>
              <li>
                <Link className="text-link" href="/classes">
                  Ofrecer lugares en clases con baja ocupación
                </Link>
                <em>{lowClasses}</em>
              </li>
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
