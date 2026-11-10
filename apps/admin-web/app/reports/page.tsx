'use client';

import type { OperationalReportsDto } from '@academy/contracts';
import { FileDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Attendance,
  Cash,
  Collections,
  Debtors,
  Students,
  Summary,
  Teachers,
} from '../../components/reports/report-sections';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { reportTab, reportTabs as tabs } from '../../lib/reports';

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
  const tab = reportTab(search.get('tab'));
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
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
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
  const pdfHref = () => {
    const params = new URLSearchParams({ from, to });
    for (const key of ['debtSort', 'classId']) {
      const value = search.get(key);
      if (value) params.set(key, value);
    }
    return `${apiUrl}/reports/pdf?${params}`;
  };

  return (
    <div className="reports-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ANÁLISIS OPERATIVO</p>
          <h1>Reportes</h1>
          <p className="subtitle">Datos reales para administrar la academia.</p>
        </div>
        <div className="page-heading-actions">
          <a
            className="button"
            href={pdfHref()}
            title="Resumen, cobros, deudores, asistencia y caja del período elegido"
          >
            <FileDown aria-hidden="true" size={16} strokeWidth={1.75} />
            Descargar PDF
          </a>
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
        <Collections data={data} exportHref={exportHref('collections')} />
      )}
      {!loading && data && tab === 'teachers' && (
        <Teachers data={data} exportHref={exportHref('teachers')} />
      )}
      {!loading && data && tab === 'debtors' && (
        <Debtors data={data} exportHref={exportHref('debtors')} search={search} query={query} />
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
