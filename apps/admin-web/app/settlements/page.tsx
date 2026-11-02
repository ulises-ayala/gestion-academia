'use client';

import type {
  ClassSettlementOverviewDto,
  ReopenSettlementDto,
  SettlementDto,
} from '@academy/contracts';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../components/auth-provider';
import { SettlementPlanModal } from '../../components/settlement-plan-modal';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { periodLabel } from '../../lib/charge-generation';
import { money } from '../../lib/collect-payment';
import { businessToday } from '../../lib/dates';
import { notifySuccess } from '../../lib/notify';
import {
  defaultSettlementPeriod,
  isPeriod,
  percentLabel,
  settlementConceptLabel,
  shiftPeriod,
} from '../../lib/settlements';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const shortDate = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Buenos_Aires',
  }).format(new Date(value));
const errorText = (error: unknown, fallback: string) =>
  error instanceof ApiClientError ? error.message : fallback;

export default function SettlementsPage() {
  return (
    <Suspense
      fallback={
        <section className="card module-state" role="status">
          Cargando liquidación…
        </section>
      }
    >
      <Settlements />
    </Suspense>
  );
}

function Settlements() {
  const { can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const requested = search.get('period');
  const period = isPeriod(requested) ? requested : defaultSettlementPeriod(businessToday());
  const tab = search.get('tab') === 'plans' ? 'plans' : 'teachers';
  const [data, setData] = useState<SettlementDto | null>(null);
  const [plans, setPlans] = useState<ClassSettlementOverviewDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ClassSettlementOverviewDto | null>(null);
  const [confirm, setConfirm] = useState<'close' | 'reopen' | null>(null);

  const go = (next: Readonly<{ period?: string; tab?: string }>) => {
    const params = new URLSearchParams(search.toString());
    if (next.period) params.set('period', next.period);
    if (next.tab) {
      if (next.tab === 'teachers') params.delete('tab');
      else params.set('tab', next.tab);
    }
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [settlement, overview] = await Promise.all([
        apiRequest<SettlementDto>(`/settlements/${period}`),
        apiRequest<ClassSettlementOverviewDto[]>(`/settlements/plans?period=${period}`),
      ]);
      setData(settlement);
      setPlans(overview);
    } catch (caught) {
      setError(errorText(caught, 'No se pudo cargar la liquidación.'));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const unconfiguredIds = new Set(data?.unconfigured.map((item) => item.classId) ?? []);
  const openPlan = (classId: string) => {
    const item = plans?.find((entry) => entry.academicClass.id === classId);
    if (item) setEditing(item);
  };

  return (
    <>
      <div className="page-heading settlements-heading">
        <div>
          <p className="eyebrow">Profesores</p>
          <h1>Liquidación</h1>
          <p className="subtitle">
            Lo cobrado en el mes (también cuotas atrasadas), repartido según el porcentaje de cada
            clase.
          </p>
        </div>
        <div className="settlement-month" role="group" aria-label="Mes a liquidar">
          <button
            type="button"
            className="secondary icon-button"
            aria-label="Mes anterior"
            onClick={() => go({ period: shiftPeriod(period, -1) })}
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <label className="settlement-month-input">
            <span className="sr-only">Mes</span>
            <input
              type="month"
              value={period}
              onChange={(event) =>
                isPeriod(event.target.value) && go({ period: event.target.value })
              }
            />
          </label>
          <button
            type="button"
            className="secondary icon-button"
            aria-label="Mes siguiente"
            onClick={() => go({ period: shiftPeriod(period, 1) })}
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
      </div>

      <div aria-label="Vistas de liquidación" className="payment-center-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'teachers'}
          className={tab === 'teachers' ? 'active' : ''}
          onClick={() => go({ tab: 'teachers' })}
        >
          Por profesor
        </button>
        <button
          role="tab"
          aria-selected={tab === 'plans'}
          className={tab === 'plans' ? 'active' : ''}
          onClick={() => go({ tab: 'plans' })}
        >
          Repartos por clase
          {data && data.unconfigured.length > 0 && (
            <span className="settlement-tab-badge">{data.unconfigured.length}</span>
          )}
        </button>
      </div>

      {error ? (
        <section className="card module-state" role="alert">
          <p>{error}</p>
          <button className="secondary" onClick={() => void load()}>
            Reintentar
          </button>
        </section>
      ) : loading && !data ? (
        <section className="card module-state" role="status">
          Cargando liquidación…
        </section>
      ) : data && tab === 'teachers' ? (
        <TeachersView
          data={data}
          canApprove={can('settlements:approve')}
          onClose={() => setConfirm('close')}
          onReopen={() => setConfirm('reopen')}
          onConfigure={openPlan}
        />
      ) : data && plans ? (
        <PlansView
          period={period}
          plans={plans}
          unconfiguredIds={unconfiguredIds}
          onEdit={setEditing}
        />
      ) : null}

      {editing && (
        <SettlementPlanModal
          item={editing}
          period={period}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notifySuccess(
              'Reparto guardado',
              `${editing.academicClass.name}: se recalculó la liquidación.`,
            );
            void load();
          }}
        />
      )}
      {confirm && data && (
        <ConfirmClosing
          mode={confirm}
          data={data}
          onCancel={() => setConfirm(null)}
          onDone={(next) => {
            setConfirm(null);
            setData(next);
            notifySuccess(
              confirm === 'close' ? 'Liquidación cerrada' : 'Liquidación reabierta',
              periodLabel(next.period),
            );
          }}
        />
      )}
    </>
  );
}

function TeachersView({
  data,
  canApprove,
  onClose,
  onReopen,
  onConfigure,
}: Readonly<{
  data: SettlementDto;
  canApprove: boolean;
  onClose(): void;
  onReopen(): void;
  onConfigure(classId: string): void;
}>) {
  const closed = data.status === 'CLOSED';
  return (
    <>
      <section className={`card settlement-status ${closed ? 'is-closed' : ''}`}>
        <div>
          <h2>{periodLabel(data.period)}</h2>
          <p className="subtitle">
            {closed
              ? `Cerrada el ${new Date(data.closedAt ?? '').toLocaleDateString('es-AR')} por ${data.closedBy?.username ?? '—'}. Queda fija aunque después cambien los pagos.${data.note ? ` Nota: ${data.note}` : ''}`
              : data.canClose
                ? 'Abierta: se recalcula con los cobros de hoy. Cerrala cuando les pagues a los profesores.'
                : 'Mes en curso: se va completando con cada cobro.'}
          </p>
        </div>
        <div className="settlement-status-actions">
          <a
            className="button secondary"
            href={`${apiUrl}/settlements/${data.period}/export`}
            download
          >
            <Download aria-hidden="true" size={16} /> Exportar CSV
          </a>
          {canApprove && !closed && data.canClose && (
            <button type="button" onClick={onClose}>
              Cerrar liquidación
            </button>
          )}
          {canApprove && closed && (
            <button type="button" className="secondary" onClick={onReopen}>
              Reabrir
            </button>
          )}
        </div>
      </section>

      <section className="settlement-totals" aria-label="Totales del mes">
        <article>
          <span>Cobrado en el mes</span>
          <strong>{money(data.totals.collected)}</strong>
          <small>
            {Number(data.totals.otherIncome) > 0
              ? `Incluye ${money(data.totals.otherIncome)} de otros cobros`
              : 'Cuotas y clases sueltas'}
          </small>
        </article>
        <article className="is-teachers">
          <span>A pagar a profesores</span>
          <strong>{money(data.totals.teachers)}</strong>
          <small>
            {data.teachers.length} {data.teachers.length === 1 ? 'profesor' : 'profesores'}
          </small>
        </article>
        <article>
          <span>Queda para la academia</span>
          <strong>{money(data.totals.academy)}</strong>
          <small>Dirección, becas y otros cobros</small>
        </article>
      </section>

      {data.unconfigured.length > 0 && (
        <section className="card settlement-warning" role="status">
          <h2>Clases cobradas sin reparto</h2>
          <p className="subtitle">
            Hasta que les cargues el porcentaje, lo cobrado queda todo para la academia.
          </p>
          <ul>
            {data.unconfigured.map((item) => (
              <li key={`${item.classId}-${item.period}`}>
                <span>
                  <strong>{item.className}</strong> · {periodLabel(item.period).toLowerCase()} ·{' '}
                  {money(item.collected)}
                </span>
                {!closed && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onConfigure(item.classId)}
                  >
                    Cargar reparto
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card settlement-teachers">
        <h2>Por profesor</h2>
        {data.teachers.length === 0 ? (
          <p className="empty-state">No hay nada para liquidar a profesores en este mes.</p>
        ) : (
          <ul className="settlement-teacher-list">
            {data.teachers.map((item) => (
              <li key={item.teacher.id}>
                <details>
                  <summary>
                    <span className="settlement-teacher-name">
                      {item.teacher.firstName} {item.teacher.lastName}
                      <small>
                        {item.lines.length} {item.lines.length === 1 ? 'cobro' : 'cobros'}
                      </small>
                    </span>
                    <strong>{money(item.total)}</strong>
                  </summary>
                  <div className="table-wrap">
                    <table className="settlement-lines">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Alumno</th>
                          <th>Clase</th>
                          <th>Concepto</th>
                          <th>Cobrado</th>
                          <th>Base</th>
                          <th>%</th>
                          <th>A liquidar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.lines.map((line, index) => (
                          <tr key={`${line.paymentId}-${index}`}>
                            <td data-label="Fecha">{shortDate(line.paidAt)}</td>
                            <td data-label="Alumno">{line.studentName}</td>
                            <td data-label="Clase">{line.className}</td>
                            <td data-label="Concepto">{settlementConceptLabel(line)}</td>
                            <td data-label="Cobrado" className="nowrap">
                              {money(line.collected)}
                            </td>
                            <td data-label="Base" className="nowrap">
                              {money(line.base)}
                              {line.base !== line.collected && (
                                <small className="table-subline">beca de Dirección</small>
                              )}
                            </td>
                            <td data-label="%" className="nowrap">
                              {percentLabel(line.percentage)}
                            </td>
                            <td data-label="A liquidar" className="nowrap">
                              <strong>{money(line.amount)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function PlansView({
  period,
  plans,
  unconfiguredIds,
  onEdit,
}: Readonly<{
  period: string;
  plans: readonly ClassSettlementOverviewDto[];
  unconfiguredIds: ReadonlySet<string>;
  onEdit(item: ClassSettlementOverviewDto): void;
}>) {
  return (
    <section className="card settlement-plans">
      <h2>Repartos por clase</h2>
      <p className="subtitle">
        Vigentes en {periodLabel(period).toLowerCase()}. Lo que no se reparte queda para la
        academia.
      </p>
      <ul className="settlement-plan-list">
        {plans.map((item) => (
          <li
            key={item.academicClass.id}
            className={unconfiguredIds.has(item.academicClass.id) ? 'is-missing' : ''}
          >
            <div>
              <strong>
                {item.academicClass.name}
                {item.academicClass.status === 'INACTIVE' && (
                  <span className="status inactive">Inactiva</span>
                )}
              </strong>
              {item.plan ? (
                <p>
                  {item.plan.shares.length === 0
                    ? 'Todo para la academia'
                    : item.plan.shares
                        .map(
                          (share) =>
                            `${share.teacher.firstName} ${share.teacher.lastName} ${percentLabel(share.percentage)}`,
                        )
                        .join(' · ')}
                  {item.plan.shares.length > 0 &&
                    ` · Academia ${percentLabel(item.plan.academyPercentage)}`}
                  <small> · desde {periodLabel(item.plan.validFrom).toLowerCase()}</small>
                </p>
              ) : (
                <p
                  className={
                    unconfiguredIds.has(item.academicClass.id) ? 'settlement-plan-missing' : ''
                  }
                >
                  {unconfiguredIds.has(item.academicClass.id)
                    ? 'Sin reparto: tuvo cobros este mes y quedan para la academia'
                    : 'Sin reparto cargado'}
                </p>
              )}
              {item.upcoming.map((plan) => (
                <p key={plan.id} className="settlement-plan-upcoming">
                  Desde {periodLabel(plan.validFrom).toLowerCase()}:{' '}
                  {plan.shares.length === 0
                    ? 'todo para la academia'
                    : plan.shares
                        .map(
                          (share) =>
                            `${share.teacher.firstName} ${share.teacher.lastName} ${percentLabel(share.percentage)}`,
                        )
                        .join(' · ')}
                </p>
              ))}
            </div>
            <button type="button" className="secondary" onClick={() => onEdit(item)}>
              {item.plan ? 'Cambiar' : 'Cargar reparto'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConfirmClosing({
  mode,
  data,
  onCancel,
  onDone,
}: Readonly<{
  mode: 'close' | 'reopen';
  data: SettlementDto;
  onCancel(): void;
  onDone(next: SettlementDto): void;
}>) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const closing = mode === 'close';
  async function submit() {
    if (saving || (!closing && !text.trim())) return;
    setSaving(true);
    setError('');
    try {
      const body: ReopenSettlementDto | { note?: string } = closing
        ? text.trim()
          ? { note: text.trim() }
          : {}
        : { reason: text.trim() };
      onDone(
        await apiRequest<SettlementDto>(`/settlements/${data.period}/${mode}`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      );
    } catch (caught) {
      setError(errorText(caught, 'No se pudo completar la operación.'));
      setSaving(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel();
      }}
    >
      <section
        aria-labelledby="settlement-confirm-title"
        aria-modal="true"
        className="modal card"
        role="dialog"
      >
        <h2 id="settlement-confirm-title">
          {closing ? 'Cerrar' : 'Reabrir'} la liquidación de{' '}
          {periodLabel(data.period).toLowerCase()}
        </h2>
        <p className="modal-copy">
          {closing
            ? `Se guarda como está: ${money(data.totals.teachers)} para profesores y ${money(data.totals.academy)} para la academia. Si después se corrige o anula un pago de este mes, la liquidación cerrada no cambia.`
            : 'Vuelve a calcularse con los cobros de hoy (incluye correcciones y anulaciones posteriores al cierre).'}
        </p>
        <label>
          {closing ? 'Nota (opcional)' : 'Motivo'}
          <textarea
            autoFocus
            maxLength={500}
            value={text}
            placeholder={closing ? 'Ej.: pagado el 05/11' : 'Ej.: faltaba un pago de octubre'}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="secondary" disabled={saving} onClick={onCancel}>
            Cancelar
          </button>
          <button disabled={saving || (!closing && !text.trim())} onClick={() => void submit()}>
            {saving ? 'Guardando…' : closing ? 'Cerrar liquidación' : 'Reabrir'}
          </button>
        </div>
      </section>
    </div>
  );
}
