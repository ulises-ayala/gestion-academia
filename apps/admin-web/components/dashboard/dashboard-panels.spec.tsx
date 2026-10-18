import type { OperationalDashboardDto } from '@academy/contracts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dashboardAlerts, nowFocus, type TodayClass } from '../../lib/dashboard-today';
import { ManagementSection } from './management-section';
import { NowPanel } from './now-panel';
import { TodayAgenda } from './today-agenda';

const lesson = (overrides: Partial<TodayClass>): TodayClass => ({
  id: 'class-1',
  name: 'Ballet inicial',
  startTime: '10:00',
  endTime: '11:00',
  teacher: 'Valentina Ruiz',
  room: 'Sala 2',
  branch: 'Centro',
  enrolledStudents: 18,
  attendanceRecords: 0,
  ...overrides,
});

const data: OperationalDashboardDto = {
  generatedAt: '2026-10-16T12:34:00.000Z',
  businessDate: '2026-10-16',
  followUp: { students: 3 },
  billing: { pendingCharges: 9, pendingDebt: '96500.00', overdueCharges: 5, overdueStudents: 4 },
  payments: { confirmedToday: 3, confirmedAmountToday: '54000.00' },
};

describe('Inicio: Ahora', () => {
  it('shows one priority with a direct action and the remaining alerts as separate rows', () => {
    const alerts = dashboardAlerts(data, () => true);
    const html = renderToStaticMarkup(
      <NowPanel
        alerts={alerts}
        attendanceHref="/attendances?date=2026-10-16"
        canTakeAttendance
        focus={nowFocus([lesson({})], alerts, '09:30')}
      />,
    );
    expect(html).toContain('Próxima clase ·');
    expect(html).toContain('Tomar asistencia');
    expect(html).toContain('href="/attendances?date=2026-10-16"');
    expect(html).toContain('3 alumnos con 3 o más ausencias');
    expect(html).toContain('5 cuotas vencidas');
    expect(html).toContain('Corresponden a 4 alumnos.');
  });

  it('promotes the first alert when no class needs attendance and does not repeat it below', () => {
    const alerts = dashboardAlerts(data, () => true);
    const html = renderToStaticMarkup(
      <NowPanel
        alerts={alerts}
        attendanceHref="/attendances"
        canTakeAttendance
        focus={nowFocus([], alerts, '12:00')}
      />,
    );
    expect(html).toContain('Requiere atención');
    expect(html.match(/3 alumnos con 3 o más ausencias/g)).toHaveLength(1);
  });
});

describe('Inicio: agenda', () => {
  it('labels attendance per class and marks the class in focus', () => {
    const html = renderToStaticMarkup(
      <TodayAgenda
        attendanceHref="/attendances"
        canTakeAttendance
        classes={[
          lesson({ id: 'a', enrolledStudents: 12, attendanceRecords: 12, startTime: '08:00' }),
          lesson({ id: 'b' }),
          lesson({ id: 'c', attendanceRecords: 4, startTime: '14:30' }),
        ]}
        dateLabel="Viernes 16 de octubre"
        focusId="b"
      />,
    );
    expect(html).toContain('Completada');
    expect(html).toContain('Pendiente');
    expect(html).toContain('Parcial');
    expect(html).toContain('(4 de 18)');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });
});

describe('Inicio: gestión', () => {
  it('opens today collections in the payment history for the business day', () => {
    const html = renderToStaticMarkup(<ManagementSection data={data} showChart={false} />);
    expect(html).toContain('href="/payments?tab=history&amp;from=2026-10-16&amp;to=2026-10-16"');
    expect(html).toContain('Deuda pendiente');
    expect(html).toContain('5 vencidas · 4 alumnos');
  });
});
