import type { OperationalReportsDto } from '@academy/contracts';
import Link from 'next/link';
import React from 'react';
import { amountDelta, barWidth, countDelta, shareOf } from '../../lib/board';
import { type ReportTab, dailySeries, dayLabelStep } from '../../lib/reports';
import { Bars, Kpi } from '../board/monthly-board';
import { compactMoney } from '../../lib/money';

type Data = OperationalReportsDto;
export type ReportQuery = (changes: Record<string, string | null>) => void;
type Search = Readonly<{ get(name: string): string | null }>;

const methods = {
  CASH: 'Efectivo',
  MERCADO_PAGO: 'Mercado Pago',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
} as const;
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const amount = (value: string) => money.format(Number(value));
const date = (value: string) => value.split('T')[0]!.split('-').reverse().join('/');
const shortDate = (value: string) => date(value).slice(0, 5);

function Heading({
  eyebrow,
  title,
  exportHref,
  exportLabel,
}: Readonly<{ eyebrow: string; title: string; exportHref?: string; exportLabel?: string }>) {
  return (
    <div className="reports-panel-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {exportHref && (
        <a className="button secondary" href={exportHref}>
          {exportLabel}
        </a>
      )}
    </div>
  );
}

/** Tarjeta del resumen: un vistazo de una pestaña, con el enlace para ver el detalle. */
function Glance({
  title,
  href,
  className,
  children,
}: Readonly<{ title: string; href: string; className: string; children: React.ReactNode }>) {
  return (
    <section className={`card reports-panel reports-glance ${className}`}>
      <div className="reports-panel-heading">
        <h2>{title}</h2>
        <Link className="text-link" href={href}>
          Ver detalle
        </Link>
      </div>
      {children}
    </section>
  );
}

export function Summary({
  data,
  tabHref = (tab) => `?tab=${tab}`,
}: Readonly<{ data: Data; tabHref?: (tab: ReportTab) => string }>) {
  const { summary, comparison, collections, cash } = data;
  const cashDifference = Number(summary.cashDifference);
  const against = `vs. ${shortDate(comparison.from)} al ${shortDate(comparison.to)}`;
  return (
    <>
      <section className="reports-group">
        <h2>
          Del período <small>{`${date(data.from)} al ${date(data.to)}`}</small>
        </h2>
        <div className="board-kpis">
          <Kpi
            delta={amountDelta(summary.collectedAmount, comparison.collectedAmount)}
            label="Cobrado"
            note={against}
            value={compactMoney(Number(summary.collectedAmount))}
          />
          <Kpi
            delta={countDelta(summary.confirmedPayments, comparison.confirmedPayments, true)}
            label="Pagos confirmados"
            note={against}
            value={summary.confirmedPayments}
          />
          <Kpi
            delta={countDelta(summary.newStudents, comparison.newStudents, true)}
            label="Altas de alumnos"
            note={against}
            value={summary.newStudents}
          />
          <Kpi
            label="Cierres de caja"
            note={`Diferencia corregida ${amount(summary.cashDifference)}`}
            value={summary.closedCashShifts}
          />
        </div>
      </section>
      <div className="reports-summary-grid">
        <Glance className="reports-span-12" href={tabHref('collections')} title="Cobros por día">
          {collections.count === 0 ? (
            <p className="empty-state">No hubo cobros en este período.</p>
          ) : (
            <DailyChart data={data} heading={false} />
          )}
        </Glance>
        <Glance className="reports-span-6" href={tabHref('debtors')} title="Mayores deudas">
          {data.debtors.items.length === 0 ? (
            <p className="empty-state">No hay cuotas pendientes.</p>
          ) : (
            <Bars
              empty=""
              items={[...data.debtors.items]
                .sort((left, right) => Number(right.totalDebt) - Number(left.totalDebt))
                .slice(0, 5)
                .map((item) => ({
                  key: item.studentId,
                  label: `${item.firstName} ${item.lastName}`,
                  value: Number(item.totalDebt),
                  text: amount(item.totalDebt),
                }))}
            />
          )}
        </Glance>
        <Glance className="reports-span-6" href={tabHref('cash')} title="Caja">
          {cash.closedShifts === 0 ? (
            <p className="empty-state">No hay cierres de caja en este período.</p>
          ) : (
            <>
              <p className="board-hero">
                <strong
                  className={
                    cashDifference < 0 ? 'reports-short' : cashDifference > 0 ? 'reports-over' : ''
                  }
                >
                  {cashDifference === 0
                    ? 'Sin diferencia'
                    : amount(Math.abs(cashDifference).toFixed(2))}
                </strong>
                {cashDifference !== 0 && <span>{cashDifference < 0 ? 'faltan' : 'sobran'}</span>}
              </p>
              <ul className="reports-facts">
                <li>
                  <span>Turnos cerrados</span>
                  <strong>{cash.closedShifts}</strong>
                </li>
                <li>
                  <span>Cierres con diferencia</span>
                  <strong>{cash.differences.length}</strong>
                </li>
                <li>
                  <span>Turnos abiertos ahora</span>
                  <strong>{cash.openShifts}</strong>
                </li>
              </ul>
            </>
          )}
        </Glance>
      </div>
    </>
  );
}

export function Students({
  data,
  exportHref,
  search,
  query,
}: Readonly<{ data: Data; exportHref: string; search: Search; query: ReportQuery }>) {
  return (
    <section className="card reports-panel">
      <Heading
        exportHref={exportHref}
        exportLabel="Exportar alumnos CSV"
        eyebrow="ALUMNOS"
        title="Situación actual"
      />
      <div className="reports-inline-filters">
        <label>
          Buscar
          <input
            defaultValue={search.get('q') ?? ''}
            onBlur={(event) => query({ q: event.target.value, page: '1' })}
            placeholder="Nombre o DNI"
          />
        </label>
        <label>
          Estado
          <select
            value={search.get('studentStatus') ?? ''}
            onChange={(event) => query({ studentStatus: event.target.value, page: '1' })}
          >
            <option value="">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
          </select>
        </label>
      </div>
      {data.students.items.length === 0 ? (
        <p className="empty-state">No hay alumnos con estos filtros.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>DNI</th>
                <th>Estado</th>
                <th>Fecha de alta</th>
                <th>Clases activas</th>
                <th>Deuda actual</th>
              </tr>
            </thead>
            <tbody>
              {data.students.items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Alumno">
                    <Link href={`/students/${item.id}`}>
                      {item.lastName}, {item.firstName}
                    </Link>
                  </td>
                  <td data-label="DNI">{item.dni}</td>
                  <td data-label="Estado">{item.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</td>
                  <td data-label="Fecha de alta">{date(item.joinedAt)}</td>
                  <td data-label="Clases activas">{item.activeEnrollments}</td>
                  <td data-label="Deuda actual">{amount(item.currentDebt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        page={data.students.page}
        pageSize={data.students.pageSize}
        query={query}
        total={data.students.total}
      />
    </section>
  );
}

/** Cobros por día: una columna por día, con el importe arriba si entran pocos días. */
function DailyChart({ data, heading = true }: Readonly<{ data: Data; heading?: boolean }>) {
  const series = dailySeries(data.from, data.to, data.collections.byDay);
  const maximum = Math.max(...series.map((item) => item.amount), 0);
  const step = dayLabelStep(series.length);
  // Dentro de un mismo mes alcanza con el día: las fechas completas se pisan en el celular.
  const sameMonth = data.from.slice(0, 7) === data.to.slice(0, 7);
  const dayLabel = (value: string) => (sameMonth ? value.slice(8, 10) : shortDate(value));
  const best = series.reduce((top, item) => (item.amount > top.amount ? item : top), series[0]!);
  return (
    <>
      {heading && <h3>Cobros por día</h3>}
      <div
        aria-label={`Cobros por día; el mejor fue el ${shortDate(best.date)} con ${compactMoney(best.amount)}`}
        className="reports-daily"
        role="img"
      >
        {series.map((item, index) => (
          <div
            className={item === best ? 'is-best' : ''}
            key={item.date}
            title={`${date(item.date)}: ${money.format(item.amount)}`}
          >
            <span>{series.length <= 14 && item.amount > 0 ? compactMoney(item.amount) : ''}</span>
            <i style={{ height: `${barWidth(item.amount, maximum)}%` }} />
            <small>{index % step === 0 ? dayLabel(item.date) : ''}</small>
          </div>
        ))}
      </div>
      <p className="board-note">
        Mejor día: {shortDate(best.date)}, con {money.format(best.amount)}.
      </p>
    </>
  );
}

export function Collections({ data, exportHref }: Readonly<{ data: Data; exportHref: string }>) {
  const { collections } = data;
  const total = Number(collections.total);
  const withShare = (value: string) =>
    `${compactMoney(Number(value))} · ${shareOf(Number(value), total) ?? 0} %`;
  return (
    <section className="card reports-panel">
      <Heading
        exportHref={exportHref}
        exportLabel="Exportar cobros CSV"
        eyebrow="FLUJO DEL PERÍODO"
        title="Cobros registrados"
      />
      {collections.count === 0 ? (
        <p className="empty-state">No hubo cobros en este período.</p>
      ) : (
        <>
          <p className="board-hero">
            <strong>{amount(collections.total)}</strong>
            <span>
              en {collections.count} {collections.count === 1 ? 'pago' : 'pagos'}
            </span>
          </p>
          <div className="reports-split">
            <div>
              <h3>Por medio de pago</h3>
              <Bars
                empty="No hubo cobros."
                items={[...collections.byMethod]
                  .sort((left, right) => Number(right.amount) - Number(left.amount))
                  .map((item) => ({
                    key: item.method,
                    label: methods[item.method],
                    value: Number(item.amount),
                    text: withShare(item.amount),
                  }))}
              />
            </div>
            <div>
              <h3>Por concepto</h3>
              <Bars
                empty="No hubo cobros."
                items={[...collections.byConceptAndMethod]
                  .sort((left, right) => Number(right.total) - Number(left.total))
                  .map((item) => ({
                    key: item.concept,
                    label: item.label,
                    value: Number(item.total),
                    text: withShare(item.total),
                  }))}
              />
            </div>
          </div>
          <DailyChart data={data} />
          <details className="reports-details">
            <summary>Detalle por concepto y medio</summary>
            <div className="table-wrap reports-concepts">
              <table>
                <caption className="sr-only">Recaudación por concepto y medio</caption>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    {collections.byMethod.map((item) => (
                      <th key={item.method}>{methods[item.method]}</th>
                    ))}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.byConceptAndMethod.map((row) => (
                    <tr key={row.concept}>
                      <td data-label="Concepto">{row.label}</td>
                      {row.byMethod.map((item) => (
                        <td data-label={methods[item.method]} key={item.method}>
                          {amount(item.amount)}
                        </td>
                      ))}
                      <td data-label="Total">
                        <strong>{amount(row.total)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    {collections.byMethod.map((item) => (
                      <td data-label={methods[item.method]} key={item.method}>
                        {amount(item.amount)}
                      </td>
                    ))}
                    <td data-label="Total">
                      <strong>{amount(collections.total)}</strong>
                    </td>
                  </tr>
                  {Number(collections.refunds.total) > 0 && (
                    <tr>
                      <th scope="row">Devoluciones de saldo a favor</th>
                      {collections.refunds.byMethod.map((item) => (
                        <td data-label={methods[item.method]} key={item.method}>
                          -{amount(item.amount)}
                        </td>
                      ))}
                      <td data-label="Total">
                        <strong>-{amount(collections.refunds.total)}</strong>
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

/** Lo cobrado en el período por profesor: base para la liquidación docente. */
export function Teachers({ data, exportHref }: Readonly<{ data: Data; exportHref: string }>) {
  const { byTeacher, singleClasses } = data.collections;
  return (
    <section className="card reports-panel">
      <Heading
        exportHref={exportHref}
        exportLabel="Exportar por profesor CSV"
        eyebrow="BASE PARA LIQUIDACIONES"
        title="Ingresos por profesor"
      />
      {byTeacher.length === 0 ? (
        <p className="empty-state">No hubo cobros de clases en este período.</p>
      ) : (
        <>
          <Bars
            empty="No hubo cobros de clases."
            items={[...byTeacher]
              .sort((left, right) => Number(right.total) - Number(left.total))
              .map((item) => ({
                key: item.teacherId,
                label: item.teacherName,
                value: Number(item.total),
                text: amount(item.total),
              }))}
          />
          <div className="table-wrap reports-concepts reports-spaced">
            <table>
              <thead>
                <tr>
                  <th>Profesor</th>
                  <th>Cuotas</th>
                  <th>Deuda anterior</th>
                  <th>Clases sueltas</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {byTeacher.map((item) => (
                  <tr key={item.teacherId}>
                    <td data-label="Profesor">
                      <Link href={`/teachers/${item.teacherId}`}>{item.teacherName}</Link>
                    </td>
                    <td data-label="Cuotas">{amount(item.charges)}</td>
                    <td data-label="Deuda anterior">{amount(item.historicalDebt)}</td>
                    <td data-label="Clases sueltas">
                      {amount(item.singleClass)}
                      {item.singleClassCount > 0 && (
                        <small className="table-subline">
                          {item.singleClassCount === 1
                            ? '1 clase'
                            : `${item.singleClassCount} clases`}
                        </small>
                      )}
                    </td>
                    <td data-label="Total">
                      <strong>{amount(item.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {singleClasses.length > 0 && (
        <details className="reports-details">
          <summary>Clases sueltas por clase</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Profesor</th>
                  <th>Clase</th>
                  <th>Clases</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {singleClasses.map((item) => (
                  <tr key={`${item.teacherId}-${item.classId}`}>
                    <td data-label="Profesor">{item.teacherName}</td>
                    <td data-label="Clase">{item.className}</td>
                    <td data-label="Clases">{item.count}</td>
                    <td data-label="Monto">{amount(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <p className="reports-note">
        Lo efectivamente cobrado en el período. Las cuotas y la deuda anterior se asignan al
        profesor actual de la clase; la clase suelta, al profesor que la dictó (queda guardado en el
        cobro). Cuánto le corresponde a cada profesor se ve en Liquidación.
      </p>
    </section>
  );
}

export function Debtors({
  data,
  exportHref,
  search,
  query,
}: Readonly<{ data: Data; exportHref: string; search: Search; query: ReportQuery }>) {
  const { summary } = data;
  return (
    <section className="card reports-panel">
      <Heading
        exportHref={exportHref}
        exportLabel="Exportar deudores CSV"
        eyebrow="AL DÍA DE HOY"
        title="Deudores"
      />
      <div className="board-kpis reports-spaced-bottom">
        <Kpi
          label="Deuda pendiente"
          note={`${data.debtors.total} ${data.debtors.total === 1 ? 'alumno' : 'alumnos'}`}
          value={compactMoney(Number(summary.pendingDebt))}
        />
        <Kpi
          label="Deuda vencida"
          note={`${summary.overdueCharges} cuotas vencidas`}
          value={compactMoney(Number(summary.overdueDebt))}
        />
      </div>
      <p className="reports-note">
        Los valores reflejan la situación actual, no una deuda histórica del período.
      </p>
      <label className="reports-sort">
        Ordenar por
        <select
          value={search.get('debtSort') ?? 'highest'}
          onChange={(event) => query({ debtSort: event.target.value, page: '1' })}
        >
          <option value="highest">Mayor deuda</option>
          <option value="oldest">Deuda más antigua</option>
        </select>
      </label>
      {data.debtors.items.length === 0 ? (
        <p className="empty-state">No hay cuotas pendientes.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Cuotas abiertas</th>
                <th>Vencidas</th>
                <th>Deuda</th>
                <th>Deuda vencida</th>
                <th>Más antigua</th>
              </tr>
            </thead>
            <tbody>
              {data.debtors.items.map((item) => (
                <tr key={item.studentId}>
                  <td data-label="Alumno">
                    <Link href={`/payments?studentId=${item.studentId}`}>
                      {item.lastName}, {item.firstName}
                      <small>DNI {item.dni}</small>
                    </Link>
                  </td>
                  <td data-label="Cuotas abiertas">{item.openCharges}</td>
                  <td data-label="Vencidas">{item.overdueCharges}</td>
                  <td data-label="Deuda">{amount(item.totalDebt)}</td>
                  <td data-label="Deuda vencida">{amount(item.overdueDebt)}</td>
                  <td data-label="Más antigua">{date(item.oldestDueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        page={data.debtors.page}
        pageSize={data.debtors.pageSize}
        query={query}
        total={data.debtors.total}
      />
    </section>
  );
}

export function Attendance({
  data,
  exportHref,
  search,
  query,
}: Readonly<{ data: Data; exportHref: string; search: Search; query: ReportQuery }>) {
  const { attendance } = data;
  const rate = shareOf(attendance.present, attendance.records);
  return (
    <section className="card reports-panel">
      <Heading
        exportHref={exportHref}
        exportLabel="Exportar asistencia CSV"
        eyebrow="REGISTROS REALES"
        title="Asistencia"
      />
      <label className="reports-sort">
        Clase
        <select
          value={search.get('classId') ?? ''}
          onChange={(event) => query({ classId: event.target.value, page: '1' })}
        >
          <option value="">Todas</option>
          {attendance.byClass.map((item) => (
            <option key={item.classId} value={item.classId}>
              {item.className}
            </option>
          ))}
        </select>
      </label>
      {attendance.records === 0 ? (
        <p className="empty-state">No hay registros de asistencia en este período.</p>
      ) : (
        <>
          <p className="board-hero">
            <strong>{rate} %</strong>
            <span>
              de presentes · {attendance.present} presentes, {attendance.absent} ausentes y{' '}
              {attendance.justified} justificados
            </span>
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Clase</th>
                  <th>Profesor actual</th>
                  <th>Presentes</th>
                  <th>Ausentes</th>
                  <th>Justificados</th>
                </tr>
              </thead>
              <tbody>
                {[...attendance.byClass]
                  .sort(
                    (left, right) =>
                      (shareOf(left.present, left.records) ?? 0) -
                      (shareOf(right.present, right.records) ?? 0),
                  )
                  .map((item) => {
                    const percent = shareOf(item.present, item.records) ?? 0;
                    return (
                      <tr key={item.classId}>
                        <td data-label="Clase">
                          <Link href={`/classes/${item.classId}`}>{item.className}</Link>
                        </td>
                        <td data-label="Profesor actual">{item.teacherName}</td>
                        <td data-label="Presentes">
                          <div className="reports-rate">
                            <span>
                              {percent} % <small>{`${item.present} de ${item.records}`}</small>
                            </span>
                            <div className="board-track">
                              <i style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        </td>
                        <td data-label="Ausentes">{item.absent}</td>
                        <td data-label="Justificados">{item.justified}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="reports-note">
        Sólo se cuentan asistencias registradas; no se estiman sesiones ni concurrencia esperada.
        Las clases van de menor a mayor porcentaje de presentes.
      </p>
    </section>
  );
}

export function Cash({ data, exportHref }: Readonly<{ data: Data; exportHref: string }>) {
  const { cash } = data;
  return (
    <div className="reports-stack">
      <section className="card reports-panel">
        <Heading
          exportHref={exportHref}
          exportLabel="Exportar caja CSV"
          eyebrow="CIERRES DEL PERÍODO"
          title="Caja"
        />
        <p>
          {cash.closedShifts} turnos cerrados · {cash.openShifts} actualmente abiertos
        </p>
        {cash.closedShifts === 0 ? (
          <p className="empty-state">No hay cierres de caja en este período.</p>
        ) : (
          <div className="cash-closing-grid">
            {cash.byMethod.map((item) => {
              const corrected = item.correctedDeclared !== item.declared;
              const difference = Number(item.correctedDifference);
              return (
                <article className="cash-closing-card" data-method={item.method} key={item.method}>
                  <header>
                    <span className="cash-method">{methods[item.method]}</span>
                    {corrected && <span className="cash-closing-tag">Corregido</span>}
                  </header>
                  <dl>
                    <div>
                      <dt>Sistema</dt>
                      <dd>{amount(item.expected)}</dd>
                    </div>
                    <div>
                      <dt>Declarado</dt>
                      <dd>
                        {amount(item.correctedDeclared)}
                        {corrected && <small>antes {amount(item.declared)}</small>}
                      </dd>
                    </div>
                  </dl>
                  <p
                    className={`cash-closing-diff${difference < 0 ? ' is-short' : difference > 0 ? ' is-over' : ''}`}
                  >
                    <span>
                      {difference < 0 ? 'Faltan' : difference > 0 ? 'Sobran' : 'Sin diferencia'}
                    </span>
                    {difference !== 0 && <strong>{amount(Math.abs(difference).toFixed(2))}</strong>}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {cash.byOperator.length > 0 && (
        <section className="card reports-panel">
          <h2>Caja por operador</h2>
          <div className="table-wrap reports-concepts">
            <table>
              <thead>
                <tr>
                  <th>Operador</th>
                  <th>Turnos</th>
                  <th>Sistema</th>
                  <th>Declarado</th>
                  <th>Diferencia corregida</th>
                </tr>
              </thead>
              <tbody>
                {cash.byOperator.map((item) => (
                  <tr key={item.userId}>
                    <td data-label="Operador">{item.username}</td>
                    <td data-label="Turnos">{item.shifts}</td>
                    <td data-label="Sistema">{amount(item.expected)}</td>
                    <td data-label="Declarado">{amount(item.declared)}</td>
                    <td
                      className={
                        Number(item.correctedDifference) < 0 ? 'cash-amount is-negative' : ''
                      }
                      data-label="Diferencia corregida"
                    >
                      {amount(item.correctedDifference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="card reports-panel">
        <h2>Cierres con diferencia</h2>
        {cash.differences.length === 0 ? (
          <p className="empty-state">No hay cierres con diferencias.</p>
        ) : (
          cash.differences.map((item) => (
            <Link className="reports-difference" href="/cash" key={item.shiftId}>
              <span>
                <strong>{item.username}</strong>
                <small>{date(item.closedAt)}</small>
              </span>
              <span>
                Original {amount(item.difference)} · Corregida {amount(item.correctedDifference)}
              </span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}

function Pager({
  page,
  total,
  pageSize,
  query,
}: Readonly<{ page: number; total: number; pageSize: number; query: ReportQuery }>) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <button
        className="secondary"
        disabled={page <= 1}
        onClick={() => query({ page: String(page - 1) })}
      >
        Anterior
      </button>
      <span>
        Página {page} de {pages}
      </span>
      <button
        className="secondary"
        disabled={page >= pages}
        onClick={() => query({ page: String(page + 1) })}
      >
        Siguiente
      </button>
    </div>
  );
}
