import type { MonthlyBoardDto } from '@academy/contracts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MonthlyBoard } from './monthly-board';

const months = ['Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov'];
const fullMonths = ['Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre'];

const boardFixture = (withMoney: boolean): MonthlyBoardDto => ({
  generatedAt: '2026-11-10T15:00:00.000Z',
  businessDate: '2026-11-10',
  month: '2026-11',
  label: 'Noviembre 2026',
  inProgress: true,
  history: months.map((shortLabel, index) => ({
    month: `2026-${String(index + 6).padStart(2, '0')}`,
    label: `${fullMonths[index]} 2026`,
    shortLabel,
    activeStudents: [160, 158, 170, 172, 178, 184][index]!,
    newStudents: [9, 7, 4, 12, 11, 14][index]!,
    dropped: [5, 6, 9, 4, 6, 8][index]!,
    ...(withMoney && {
      collected: ['5100000', '5600000', '4900000', '6200000', '6700000', '7240000'][index]!,
    }),
  })),
  dropReasons: [
    { reason: 'NO_LONGER_ATTENDING', label: 'Dejó la actividad', count: 3 },
    { reason: 'NON_PAYMENT', label: 'Morosidad', count: 2 },
  ],
  overdueStudents: 23,
  classes: [
    {
      id: 'c1',
      name: 'Kizomba inicial',
      teacher: 'Martín Sosa',
      capacity: 20,
      enrolled: 6,
      started: 1,
      ended: 2,
      attendancePercent: 61,
      ...(withMoney && { collected: '240000.00', overdue: '40000.00' }),
    },
    {
      id: 'c2',
      name: 'Bachata intermedio',
      teacher: 'Diego Paz',
      capacity: 24,
      enrolled: 24,
      started: 1,
      ended: 0,
      attendancePercent: null,
      ...(withMoney && { collected: '960000.00', overdue: '0.00' }),
    },
  ],
  leads: { inquiries: 32, trials: 18, enrolled: 11, previousInquiries: 25, previousEnrolled: 7 },
  ...(withMoney && {
    money: {
      overdueDebt: '640000.00',
      charges: {
        total: '7200000.00',
        paidAmount: '5620000.00',
        paidCount: 141,
        openAmount: '940000.00',
        openCount: 24,
        overdueAmount: '640000.00',
        overdueCount: 16,
      },
      byMethod: [
        { method: 'MERCADO_PAGO', label: 'Mercado Pago', amount: '3100000.00' },
        { method: 'CASH', label: 'Efectivo', amount: '2460000.00' },
      ],
      byConcept: [{ key: 'CHARGES', label: 'Cuotas', amount: '6120000.00' }],
    },
  }),
});

describe('MonthlyBoard', () => {
  it('muestra a Dirección el resumen, la cobranza y la plata por clase', () => {
    const html = renderToStaticMarkup(<MonthlyBoard data={boardFixture(true)} />);
    expect(html).toContain('Alumnos activos');
    expect(html).toContain('▲ 6');
    expect(html).toContain('vs. octubre');
    expect(html).toContain('Cobranza de las cuotas de noviembre');
    expect(html).toContain('78 %');
    expect(html).toContain('Por medio de pago');
    expect(html).toContain('Recaudado');
    expect(html).toMatch(/Kizomba inicial[\s\S]*Baja[\s\S]*Bachata intermedio[\s\S]*Completa/);
    expect(html).toContain('Se inscribió el 34 % de las consultas. El mes anterior, 28 %.');
    expect(html).not.toContain('Para hacer');
  });

  it('a Admisión no le muestra importes y le deja tareas a la vista', () => {
    const html = renderToStaticMarkup(<MonthlyBoard data={boardFixture(false)} />);
    expect(html).toContain('Alumnos con cuotas vencidas');
    expect(html).toContain('Para hacer');
    expect(html).toContain('Altas y bajas');
    expect(html).not.toMatch(/Recaudado|Cobranza|Por medio de pago|Por concepto|Vencido|\$/);
  });

  it('avisa cuando el mes no tiene datos', () => {
    const empty: MonthlyBoardDto = {
      ...boardFixture(false),
      dropReasons: [],
      classes: [],
      leads: { inquiries: 0, trials: 0, enrolled: 0, previousInquiries: 0, previousEnrolled: 0 },
    };
    const html = renderToStaticMarkup(<MonthlyBoard data={empty} />);
    expect(html).toContain('No hubo bajas este mes.');
    expect(html).toContain('No hay clases activas.');
    expect(html).toContain('No se cargaron consultas este mes.');
  });
});
