'use client';

import type { OperationalReportsDto } from '@academy/contracts';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClientError, apiRequest } from '../../lib/api-client';

const tabs = [
  ['summary', 'Resumen'],
  ['students', 'Alumnos'],
  ['collections', 'Cobros y deuda'],
  ['attendance', 'Asistencia'],
  ['cash', 'Caja'],
] as const;
type Tab = (typeof tabs)[number][0];
const methods = { CASH: 'Efectivo', MERCADO_PAGO: 'Mercado Pago', CARD: 'Tarjeta' } as const;
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const amount = (value: string) => money.format(Number(value));
const date = (value: string) => value.split('T')[0]!.split('-').reverse().join('/');
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const currentMonth = () => {
  const value = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return { from: `${value.slice(0, 7)}-01`, to: value };
};

export default function ReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const defaults = useMemo(currentMonth, []);
  const tab = (
    tabs.some(([key]) => key === search.get('tab')) ? search.get('tab') : 'summary'
  ) as Tab;
  const from = search.get('from') ?? defaults.from;
  const to = search.get('to') ?? defaults.to;
  const page = Math.max(1, Number(search.get('page') ?? 1) || 1);
  const [data, setData] = useState<OperationalReportsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  const query = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(search.toString());
      for (const [key, value] of Object.entries(changes))
        value ? next.set(key, value) : next.delete(key);
      router.push(`${pathname}?${next}`);
    },
    [pathname, router, search],
  );
  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams({ from, to, page: String(page), pageSize: '20' });
      for (const key of ['studentStatus', 'q', 'debtSort', 'classId']) {
        const value = search.get(key);
        if (value) params.set(key, value);
      }
      setData(await apiRequest<OperationalReportsDto>(`/reports/operational?${params}`));
    } catch (error) {
      setMessage(
        error instanceof ApiClientError ? error.message : 'No pudimos cargar este reporte.',
      );
    } finally {
      setLoading(false);
    }
  }, [from, page, search, to]);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  const exportHref = (kind: string) => {
    const params = new URLSearchParams({ from, to });
    for (const key of ['studentStatus', 'q', 'debtSort', 'classId']) {
      const value = search.get(key);
      if (value) params.set(key, value);
    }
    return `${apiUrl}/reports/export/${kind}?${params}`;
  };

  return (
    <div className="reports-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ANÁLISIS OPERATIVO</p>
          <h1>Reportes</h1>
          <p className="subtitle">Datos reales para administrar la academia.</p>
        </div>
      </header>
      <nav aria-label="Secciones de reportes" className="reports-tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <Link
            aria-selected={tab === key}
            className={tab === key ? 'active' : ''}
            href={`${pathname}?${new URLSearchParams({ ...Object.fromEntries(search), tab: key, page: '1' })}`}
            key={key}
            role="tab"
          >
            {label}
          </Link>
        ))}
      </nav>
      <section className="card reports-filters">
        <label>
          Desde
          <input
            type="date"
            value={draftFrom}
            onChange={(event) => setDraftFrom(event.target.value)}
          />
        </label>
        <label>
          Hasta
          <input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} />
        </label>
        <button onClick={() => query({ from: draftFrom, to: draftTo, page: '1' })}>
          Aplicar período
        </button>
        <div className="reports-presets" aria-label="Períodos rápidos">
          <button
            className="secondary"
            onClick={() => query({ from: defaults.to, to: defaults.to, page: '1' })}
          >
            Hoy
          </button>
          <button
            className="secondary"
            onClick={() => query({ from: defaults.from, to: defaults.to, page: '1' })}
          >
            Este mes
          </button>
        </div>
      </section>
      {loading && (
        <div className="module-state">
          Cargando reporte de {tabs.find(([key]) => key === tab)?.[1].toLowerCase()}…
        </div>
      )}
      {!loading && message && (
        <div className="module-state" role="alert">
          <p>No pudimos cargar este reporte.</p>
          <p className="error">{message}</p>
          <button onClick={() => void load()}>Reintentar</button>
        </div>
      )}
      {!loading && data && tab === 'summary' && <Summary data={data} />}
      {!loading && data && tab === 'students' && (
        <Students data={data} exportHref={exportHref('students')} search={search} query={query} />
      )}
      {!loading && data && tab === 'collections' && (
        <Collections data={data} exportHref={exportHref} search={search} query={query} />
      )}
      {!loading && data && tab === 'attendance' && (
        <Attendance
          data={data}
          exportHref={exportHref('attendance')}
          search={search}
          query={query}
        />
      )}
      {!loading && data && tab === 'cash' && <Cash data={data} exportHref={exportHref('cash')} />}
    </div>
  );
}

function Summary({ data }: { data: OperationalReportsDto }) {
  const metrics = [
    ['Alumnos activos', data.summary.activeStudents],
    ['Alumnos inactivos', data.summary.inactiveStudents],
    ['Altas del período', data.summary.newStudents],
    ['Deuda pendiente actual', amount(data.summary.pendingDebt)],
    ['Cuotas vencidas actuales', data.summary.overdueCharges],
    ['Cobrado en el período', amount(data.summary.collectedAmount)],
    ['Pagos confirmados', data.summary.confirmedPayments],
    ['Cierres de caja', data.summary.closedCashShifts],
    ['Diferencia de caja corregida', amount(data.summary.cashDifference)],
  ];
  return (
    <>
      <section className="reports-section-heading">
        <div>
          <p className="eyebrow">RESUMEN</p>
          <h2>
            {date(data.from)} — {date(data.to)}
          </h2>
        </div>
      </section>
      <div className="reports-metrics">
        {metrics.map(([label, value]) => (
          <article className="card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <p className="reports-note">
        Deuda, vencidas y estado de alumnos son una fotografía actual. Cobros, altas y cierres
        corresponden al período elegido.
      </p>
    </>
  );
}

type Query = (changes: Record<string, string | null>) => void;
function Students({
  data,
  exportHref,
  search,
  query,
}: {
  data: OperationalReportsDto;
  exportHref: string;
  search: ReturnType<typeof useSearchParams>;
  query: Query;
}) {
  return (
    <section className="card reports-panel">
      <div className="reports-panel-heading">
        <div>
          <p className="eyebrow">ALUMNOS</p>
          <h2>Situación actual</h2>
        </div>
        <a className="button secondary" href={exportHref}>
          Exportar alumnos CSV
        </a>
      </div>
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
        total={data.students.total}
        pageSize={data.students.pageSize}
        query={query}
      />
    </section>
  );
}

function Collections({
  data,
  exportHref,
  search,
  query,
}: {
  data: OperationalReportsDto;
  exportHref: (kind: string) => string;
  search: ReturnType<typeof useSearchParams>;
  query: Query;
}) {
  const max = Math.max(...data.collections.byDay.map((item) => Number(item.amount)), 1);
  return (
    <div className="reports-stack">
      <section className="card reports-panel">
        <div className="reports-panel-heading">
          <div>
            <p className="eyebrow">FLUJO DEL PERÍODO</p>
            <h2>Cobros registrados</h2>
          </div>
          <a className="button secondary" href={exportHref('collections')}>
            Exportar cobros CSV
          </a>
        </div>
        <div className="reports-metrics compact">
          <article>
            <span>Total cobrado</span>
            <strong>{amount(data.collections.total)}</strong>
          </article>
          <article>
            <span>Pagos confirmados</span>
            <strong>{data.collections.count}</strong>
          </article>
          {data.collections.byMethod.map((item) => (
            <article key={item.method}>
              <span>{methods[item.method]}</span>
              <strong>{amount(item.amount)}</strong>
            </article>
          ))}
        </div>
        {data.collections.count === 0 ? (
          <p className="empty-state">No hubo cobros en este período.</p>
        ) : (
          <div className="reports-chart" aria-label="Evolución diaria de cobros">
            {data.collections.byDay.map((item) => (
              <div key={item.date}>
                <span
                  title={amount(item.amount)}
                  style={{ height: `${Math.max(8, (Number(item.amount) / max) * 100)}%` }}
                />
                <small>{date(item.date).slice(0, 5)}</small>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="card reports-panel">
        <div className="reports-panel-heading">
          <div>
            <p className="eyebrow">SNAPSHOT ACTUAL</p>
            <h2>Deudores</h2>
          </div>
          <a className="button secondary" href={exportHref('debtors')}>
            Exportar deudores CSV
          </a>
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
          total={data.debtors.total}
          pageSize={data.debtors.pageSize}
          query={query}
        />
      </section>
    </div>
  );
}

function Attendance({
  data,
  exportHref,
  search,
  query,
}: {
  data: OperationalReportsDto;
  exportHref: string;
  search: ReturnType<typeof useSearchParams>;
  query: Query;
}) {
  return (
    <section className="card reports-panel">
      <div className="reports-panel-heading">
        <div>
          <p className="eyebrow">REGISTROS REALES</p>
          <h2>Asistencia</h2>
        </div>
        <a className="button secondary" href={exportHref}>
          Exportar asistencia CSV
        </a>
      </div>
      <label className="reports-sort">
        Clase
        <select
          value={search.get('classId') ?? ''}
          onChange={(event) => query({ classId: event.target.value, page: '1' })}
        >
          <option value="">Todas</option>
          {data.attendance.byClass.map((item) => (
            <option key={item.classId} value={item.classId}>
              {item.className}
            </option>
          ))}
        </select>
      </label>
      <div className="reports-metrics compact">
        <article>
          <span>Total registros</span>
          <strong>{data.attendance.records}</strong>
        </article>
        <article>
          <span>Presentes</span>
          <strong>{data.attendance.present}</strong>
        </article>
        <article>
          <span>Ausentes</span>
          <strong>{data.attendance.absent}</strong>
        </article>
        <article>
          <span>Justificados</span>
          <strong>{data.attendance.justified}</strong>
        </article>
      </div>
      {data.attendance.records === 0 ? (
        <p className="empty-state">No hay registros de asistencia en este período.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Clase</th>
                <th>Profesor actual</th>
                <th>Registros</th>
                <th>Presentes</th>
                <th>Ausentes</th>
                <th>Justificados</th>
              </tr>
            </thead>
            <tbody>
              {data.attendance.byClass.map((item) => (
                <tr key={item.classId}>
                  <td data-label="Clase">
                    <Link href={`/classes/${item.classId}`}>{item.className}</Link>
                  </td>
                  <td data-label="Profesor actual">{item.teacherName}</td>
                  <td data-label="Registros">{item.records}</td>
                  <td data-label="Presentes">{item.present}</td>
                  <td data-label="Ausentes">{item.absent}</td>
                  <td data-label="Justificados">{item.justified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="reports-note">
        Sólo se cuentan asistencias registradas; no se estiman sesiones ni concurrencia esperada.
      </p>
    </section>
  );
}

function Cash({ data, exportHref }: { data: OperationalReportsDto; exportHref: string }) {
  return (
    <div className="reports-stack">
      <section className="card reports-panel">
        <div className="reports-panel-heading">
          <div>
            <p className="eyebrow">CIERRES DEL PERÍODO</p>
            <h2>Caja</h2>
          </div>
          <a className="button secondary" href={exportHref}>
            Exportar caja CSV
          </a>
        </div>
        <p>
          {data.cash.closedShifts} turnos cerrados · {data.cash.openShifts} actualmente abiertos
        </p>
        {data.cash.closedShifts === 0 ? (
          <p className="empty-state">No hay cierres de caja en este período.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Medio</th>
                  <th>Esperado</th>
                  <th>Declarado</th>
                  <th>Diferencia</th>
                  <th>Declarado corregido</th>
                  <th>Diferencia corregida</th>
                </tr>
              </thead>
              <tbody>
                {data.cash.byMethod.map((item) => (
                  <tr key={item.method}>
                    <td data-label="Medio">{methods[item.method]}</td>
                    <td data-label="Esperado">{amount(item.expected)}</td>
                    <td data-label="Declarado">{amount(item.declared)}</td>
                    <td data-label="Diferencia">{amount(item.difference)}</td>
                    <td data-label="Declarado corregido">{amount(item.correctedDeclared)}</td>
                    <td data-label="Diferencia corregida">{amount(item.correctedDifference)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card reports-panel">
        <h2>Caja por operador</h2>
        {data.cash.byOperator.map((item) => (
          <article className="reports-operator" key={item.userId}>
            <strong>{item.username}</strong>
            <span>{item.shifts} turnos</span>
            <span>Esperado {amount(item.expected)}</span>
            <span>Declarado {amount(item.declared)}</span>
            <span>Diferencia corregida {amount(item.correctedDifference)}</span>
          </article>
        ))}
      </section>
      <section className="card reports-panel">
        <h2>Cierres con diferencia</h2>
        {data.cash.differences.length === 0 ? (
          <p className="empty-state">No hay cierres con diferencias.</p>
        ) : (
          data.cash.differences.map((item) => (
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
}: {
  page: number;
  total: number;
  pageSize: number;
  query: Query;
}) {
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
