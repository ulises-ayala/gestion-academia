import type { EnrollmentDto, MonthlyChargeDto, StudentDto } from '@academy/contracts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentChargeGrid } from './student-charge-grid';

const student = {
  id: 's1',
  firstName: 'Ana',
  lastName: 'Paz',
  dni: '30111222',
  phone: '5493704123456',
} as StudentDto;

const enrollment = (id: string, className: string): EnrollmentDto =>
  ({
    id,
    studentId: 's1',
    classId: `c-${id}`,
    startDate: '2026-09-01',
    endDate: null,
    status: 'ACTIVE',
    tariff: null,
    paymentDueDay: 10,
    academicClass: { id: `c-${id}`, name: className },
  }) as EnrollmentDto;

const charge = (
  enrollmentId: string,
  period: string,
  over: Partial<MonthlyChargeDto> = {},
): MonthlyChargeDto =>
  ({
    id: `${enrollmentId}-${period}`,
    studentId: 's1',
    enrollmentId,
    kind: 'MONTHLY',
    description: null,
    period: `${period}-01`,
    studentDueAmount: '40000.00',
    paidAmount: '0.00',
    outstandingAmount: '40000.00',
    dueDate: `${period}-10`,
    overdue: false,
    status: 'PENDING',
    academicClass: { id: `c-${enrollmentId}`, name: enrollmentId },
    ...over,
  }) as MonthlyChargeDto;

const enrollments = [enrollment('bac', 'Bachata'), enrollment('sal', 'Salsa')];
const charges = [
  charge('bac', '2026-09', { paidAmount: '40000.00', outstandingAmount: '0.00', status: 'PAID' }),
  charge('bac', '2026-10', { overdue: true }),
  charge('bac', '2026-11', {
    paidAmount: '15000.00',
    outstandingAmount: '25000.00',
    status: 'PARTIAL',
  }),
];
const render = (canGenerate: boolean, list = charges) =>
  renderToStaticMarkup(
    <StudentChargeGrid
      canGenerate={canGenerate}
      charges={list}
      initialEnrollments={enrollments}
      onChanged={() => undefined}
      onCollect={() => undefined}
      student={student}
    />,
  ).replace(/\u00a0/g, ' ');

describe('StudentChargeGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T15:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('muestra cada clase con sus meses: pagada, vencida, parcial y sin generar', () => {
    const html = render(true);
    expect(html).toContain('Cuotas por clase y mes');
    expect(html).toMatch(/Bachata[\s\S]*Salsa/);
    expect(html).toContain('Pagada');
    expect(html).toContain('venció el 10/10');
    expect(html).toContain('resta de $ 40.000,00');
    expect(html).toContain('aria-label="Salsa, Octubre: sin generar"');
    // Salsa: septiembre, octubre y noviembre sin generar; diciembre no cuenta todavía.
    expect(html).toContain('<strong>3 cuotas</strong> sin generar hasta noviembre');
    expect(html).toContain('Marcar las que faltan');
    expect(html).toContain('Enviar detalle por WhatsApp');
    expect(html).toContain('$ 65.000,00');
  });

  it('quien no genera cuotas ve lo que falta, sin poder marcarlo', () => {
    const html = render(false);
    expect(html).toContain('Sin generar');
    expect(html).not.toContain('Marcar las que faltan');
    expect(html).not.toContain('sin generar"');
    // Las pendientes sí se pueden marcar para cobrar.
    expect(html).toContain('aria-label="Bachata, Octubre: debe $ 40.000,00, venció el 10/10"');
  });

  it('sin deuda no ofrece el recordatorio', () => {
    const html = render(true, []);
    expect(html).not.toContain('WhatsApp');
    // Sin cuotas generadas no está al día: le faltan.
    expect(html).not.toContain('Al día');
    expect(html).toContain('Marcar las que faltan');
  });
});
