import type { MonthlyBoardDto } from '@academy/contracts';
import Link from 'next/link';
import React, { type ReactNode } from 'react';
import {
  type Delta,
  amountDelta,
  barWidth,
  classOccupancy,
  countDelta,
  shareOf,
} from '../../lib/board';
import { compactMoney } from '../confirmed-payments-chart';

type History = MonthlyBoardDto['history'][number];
const amount = (value: string | undefined) => compactMoney(Number(value ?? 0));

export function Kpi({
  label,
  value,
  delta,
  note,
}: Readonly<{ label: string; value: ReactNode; delta?: Delta | null; note: string }>) {
  return (
    <div className="board-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <p className={`board-delta${delta ? ` is-${delta.tone}` : ''}`}>
        {delta && <b>{delta.text}</b>} {note}
      </p>
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

/** Columnas por mes: una o dos series, con el valor arriba y el mes consultado resaltado. */
function MonthColumns({
  history,
  series,
  summary,
}: Readonly<{
  history: readonly History[];
  series: readonly Readonly<{
    name: string;
    className: string;
    value(item: History): number;
    format(value: number): string;
  }>[];
  summary: string;
}>) {
  const maximum = Math.max(...history.flatMap((item) => series.map((one) => one.value(item))), 0);
  if (maximum === 0) return <p className="board-empty">Todavía no hay datos en estos meses.</p>;
  return (
    <>
      <div aria-label={summary} className="board-columns" role="img">
        {history.map((item, index) => (
          <div
            className={`board-column${index === history.length - 1 ? ' is-current' : ''}`}
            key={item.month}
          >
            <span>{series.map((one) => one.format(one.value(item))).join(' · ')}</span>
            <div className="board-column-bars">
              {series.map((one) => (
                <i
                  className={one.className}
                  key={one.name}
                  style={{ height: `${barWidth(one.value(item), maximum)}%` }}
                  title={`${item.label} · ${one.name}: ${one.format(one.value(item))}`}
                />
              ))}
            </div>
            <span>{item.shortLabel}</span>
          </div>
        ))}
      </div>
      {series.length > 1 && (
        <div className="board-legend">
          {series.map((one) => (
            <span key={one.name}>
              <i className={one.className} />
              {one.name}
            </span>
          ))}
        </div>
      )}
    </>
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
  const against = `vs. ${previous.label.split(' ')[0]!.toLowerCase()}`;
  const { money, leads } = data;
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
          value={current.activeStudents}
        />
        <Kpi
          delta={countDelta(current.newStudents, previous.newStudents, true)}
          label="Altas"
          note={against}
          value={current.newStudents}
        />
        <Kpi
          delta={countDelta(current.dropped, previous.dropped, false)}
          label="Bajas"
          note={against}
          value={current.dropped}
        />
        {money ? (
          <>
            <Kpi
              delta={amountDelta(current.collected ?? '0', previous.collected ?? '0')}
              label="Recaudado"
              note={against}
              value={amount(current.collected)}
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
        {charges && (
          <Card
            className="board-span-7"
            description="Cuánto de lo que había que cobrar por las cuotas de este mes ya entró."
            title={`Cobranza de las cuotas de ${data.label.split(' ')[0]!.toLowerCase()}`}
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
          <Card
            className="board-span-5"
            description="Todo lo cobrado por mes, últimos 6 meses."
            title="Recaudación"
          >
            <MonthColumns
              history={data.history}
              series={[
                {
                  name: 'Recaudado',
                  className: 'is-solo',
                  value: (item) => Number(item.collected ?? 0),
                  format: compactMoney,
                },
              ]}
              summary={`Recaudación de los últimos 6 meses; ${current.label}: ${amount(current.collected)}`}
            />
          </Card>
        )}

        <Card
          className="board-span-6"
          description="Alumnos que empezaron y que dejaron, últimos 6 meses."
          title="Altas y bajas"
        >
          <MonthColumns
            history={data.history}
            series={[
              {
                name: 'Altas',
                className: 'is-in',
                value: (item) => item.newStudents,
                format: String,
              },
              {
                name: 'Bajas',
                className: 'is-out',
                value: (item) => item.dropped,
                format: String,
              },
            ]}
            summary={`Altas y bajas de los últimos 6 meses; ${current.label}: ${current.newStudents} altas y ${current.dropped} bajas`}
          />
        </Card>

        <Card
          className="board-span-6"
          description={`Motivo de las bajas de ${data.label.split(' ')[0]!.toLowerCase()}.`}
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
              description="Cómo pagaron en el mes."
              title="Por medio de pago"
            >
              <Bars
                empty="No hubo cobros este mes."
                items={money.byMethod.map((item) => ({
                  key: item.method,
                  label: item.label,
                  value: Number(item.amount),
                  text: `${amount(item.amount)} · ${shareOf(Number(item.amount), collectedTotal) ?? 0} %`,
                }))}
              />
            </Card>
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
          className={money ? 'board-span-4' : 'board-span-6'}
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
            className="board-span-6"
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
