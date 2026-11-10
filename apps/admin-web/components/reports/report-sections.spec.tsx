import type { OperationalReportsDto, PaymentMethodDto } from '@academy/contracts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Attendance,
  Cash,
  Collections,
  Debtors,
  Students,
  Summary,
  Teachers,
} from './report-sections';

const byMethod = (cash: string, mp: string, transfer: string, card: string) =>
  (
    [
      ['CASH', cash],
      ['MERCADO_PAGO', mp],
      ['TRANSFER', transfer],
      ['CARD', card],
    ] as const
  ).map(([method, amount]) => ({ method: method as PaymentMethodDto, amount }));

const reportFixture = (): OperationalReportsDto => ({
  generatedAt: '2026-11-10T15:00:00.000Z',
  businessDate: '2026-11-10',
  from: '2026-11-01',
  to: '2026-11-10',
  summary: {
    activeStudents: 184,
    inactiveStudents: 37,
    newStudents: 14,
    pendingDebt: '1580000.00',
    overdueCharges: 16,
    overdueDebt: '640000.00',
    collectedAmount: '2710000.00',
    confirmedPayments: 68,
    closedCashShifts: 9,
    cashDifference: '-3000.00',
  },
  comparison: {
    from: '2026-10-22',
    to: '2026-10-31',
    collectedAmount: '2500000.00',
    confirmedPayments: 61,
    newStudents: 11,
  },
  students: {
    items: [
      {
        id: 's1',
        firstName: 'Lucía',
        lastName: 'Gómez',
        dni: '40123456',
        status: 'ACTIVE',
        joinedAt: '2026-03-02',
        activeEnrollments: 2,
        currentDebt: '40000.00',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  },
  collections: {
    total: '2710000.00',
    count: 68,
    byMethod: byMethod('920000.00', '1150000.00', '390000.00', '250000.00'),
    byDay: [
      { date: '2026-11-02', amount: '310000.00' },
      { date: '2026-11-03', amount: '520000.00' },
      { date: '2026-11-04', amount: '280000.00' },
      { date: '2026-11-05', amount: '640000.00' },
      { date: '2026-11-06', amount: '410000.00' },
      { date: '2026-11-09', amount: '330000.00' },
      { date: '2026-11-10', amount: '220000.00' },
    ],
    byConcept: { charges: '2300000.00', singleClass: '180000.00', other: '230000.00' },
    byConceptAndMethod: [
      {
        concept: 'CHARGES',
        label: 'Cuotas',
        byMethod: byMethod('780000.00', '980000.00', '330000.00', '210000.00'),
        total: '2300000.00',
      },
      {
        concept: 'SINGLE_CLASS',
        label: 'Clase suelta',
        byMethod: byMethod('100000.00', '80000.00', '0.00', '0.00'),
        total: '180000.00',
      },
      {
        concept: 'k1',
        label: 'Indumentaria',
        byMethod: byMethod('40000.00', '90000.00', '60000.00', '40000.00'),
        total: '230000.00',
      },
    ],
    refunds: { total: '0.00', byMethod: byMethod('0.00', '0.00', '0.00', '0.00') },
    singleClasses: [
      {
        classId: 'c1',
        className: 'Kizomba inicial',
        teacherId: 't1',
        teacherName: 'Martín Sosa',
        count: 6,
        amount: '180000.00',
      },
    ],
    byTeacher: [
      {
        teacherId: 't1',
        teacherName: 'Martín Sosa',
        charges: '700000.00',
        historicalDebt: '40000.00',
        singleClass: '180000.00',
        singleClassCount: 6,
        total: '920000.00',
      },
      {
        teacherId: 't2',
        teacherName: 'Camila Ruiz',
        charges: '1600000.00',
        historicalDebt: '0.00',
        singleClass: '0.00',
        singleClassCount: 0,
        total: '1600000.00',
      },
    ],
  },
  debtors: {
    items: [
      {
        studentId: 's2',
        firstName: 'Ana',
        lastName: 'Pérez',
        dni: '30111222',
        openCharges: 3,
        overdueCharges: 2,
        totalDebt: '120000.00',
        overdueDebt: '80000.00',
        oldestDueDate: '2026-10-10',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  },
  attendance: {
    records: 300,
    present: 240,
    absent: 45,
    justified: 15,
    byClass: [
      {
        classId: 'c2',
        className: 'Bachata intermedio',
        teacherName: 'Diego Paz',
        records: 200,
        present: 182,
        absent: 12,
        justified: 6,
      },
      {
        classId: 'c1',
        className: 'Kizomba inicial',
        teacherName: 'Martín Sosa',
        records: 100,
        present: 58,
        absent: 33,
        justified: 9,
      },
    ],
  },
  cash: {
    closedShifts: 9,
    openShifts: 1,
    byMethod: [
      {
        method: 'CASH',
        expected: '920000.00',
        declared: '915000.00',
        difference: '-5000.00',
        correctedDeclared: '917000.00',
        correctedDifference: '-3000.00',
      },
      {
        method: 'MERCADO_PAGO',
        expected: '1150000.00',
        declared: '1150000.00',
        difference: '0.00',
        correctedDeclared: '1150000.00',
        correctedDifference: '0.00',
      },
      {
        method: 'TRANSFER',
        expected: '390000.00',
        declared: '390000.00',
        difference: '0.00',
        correctedDeclared: '390000.00',
        correctedDifference: '0.00',
      },
      {
        method: 'CARD',
        expected: '250000.00',
        declared: '252000.00',
        difference: '2000.00',
        correctedDeclared: '252000.00',
        correctedDifference: '2000.00',
      },
    ],
    byOperator: [
      {
        userId: 'u1',
        username: 'adriana',
        shifts: 6,
        expected: '1800000.00',
        declared: '1797000.00',
        difference: '-5000.00',
        correctedDifference: '-3000.00',
      },
    ],
    differences: [
      {
        shiftId: 'sh1',
        closedAt: '2026-11-05T23:10:00.000Z',
        username: 'adriana',
        difference: '-5000.00',
        correctedDifference: '-3000.00',
      },
    ],
  },
});

const search = { get: () => null };
const query = () => undefined;

describe('secciones de Reportes', () => {
  const data = reportFixture();

  it('el resumen compara lo del período con el período anterior', () => {
    const html = renderToStaticMarkup(<Summary data={data} />);
    expect(html).toContain('01/11/2026 al 10/11/2026');
    expect(html).toContain('▲ 8,4 %');
    expect(html).toContain('▲ 7');
    expect(html).toContain('▲ 3');
    expect(html).toContain('vs. 22/10 al 31/10');
    expect(html).toContain('no depende del período elegido');
    expect(html).toContain('16 cuotas vencidas');
  });

  it('el resumen da un vistazo de cobros, asistencia, deudas y caja con su enlace', () => {
    const html = renderToStaticMarkup(
      <Summary data={data} tabHref={(tab) => `/reports?tab=${tab}`} />,
    );
    expect(html.match(/reports-glance/g)).toHaveLength(5);
    expect(html.match(/title="\d\d\/11\/2026:/g)).toHaveLength(10);
    expect(html).toMatch(/Por medio de pago[\s\S]*Mercado Pago[\s\S]*42 %/);
    // La clase con menos presentes va primera.
    expect(html).toMatch(/80 %[\s\S]*Kizomba inicial[\s\S]*58 %[\s\S]*Bachata intermedio/);
    expect(html).toMatch(/Mayores deudas[\s\S]*Ana Pérez/);
    expect(html).toMatch(/reports-short[\s\S]*3\.000,00[\s\S]*faltan/);
    for (const tab of ['collections', 'attendance', 'debtors', 'cash'])
      expect(html).toContain(`href="/reports?tab=${tab}"`);
  });

  it('cobros muestra medios y conceptos ordenados, los días y el detalle', () => {
    const html = renderToStaticMarkup(<Collections data={data} exportHref="/csv" />);
    expect(html).toMatch(/Mercado Pago[\s\S]*Efectivo[\s\S]*Transferencia[\s\S]*Tarjeta/);
    expect(html).toContain('42 %');
    expect(html).toMatch(/Cuotas[\s\S]*Indumentaria[\s\S]*Clase suelta/);
    // Diez días del período, con los que no tuvieron cobros.
    expect(html.match(/title="\d\d\/11\/2026:/g)).toHaveLength(10);
    expect(html).toContain('Mejor día: 05/11');
    expect(html).toContain('Detalle por concepto y medio');
    expect(html).not.toContain('Devoluciones de saldo a favor');
  });

  it('sin cobros avisa en lugar de dibujar gráficos', () => {
    const empty = {
      ...data,
      collections: { ...data.collections, count: 0, total: '0.00', byDay: [] },
    };
    const html = renderToStaticMarkup(<Collections data={empty} exportHref="/csv" />);
    expect(html).toContain('No hubo cobros en este período.');
    expect(html).not.toContain('Cobros por día');
  });

  it('profesores y deudores tienen su propia sección', () => {
    const teachers = renderToStaticMarkup(<Teachers data={data} exportHref="/csv" />);
    expect(teachers).toMatch(/Camila Ruiz[\s\S]*Martín Sosa/);
    expect(teachers).toContain('6 clases');
    const debtors = renderToStaticMarkup(
      <Debtors data={data} exportHref="/csv" query={query} search={search} />,
    );
    expect(debtors).toContain('Pérez, Ana');
    expect(debtors).toContain('Los valores reflejan la situación actual');
    expect(debtors).toContain('Página 1 de 1');
  });

  it('asistencia ordena las clases de menor a mayor porcentaje de presentes', () => {
    const html = renderToStaticMarkup(
      <Attendance data={data} exportHref="/csv" query={query} search={search} />,
    );
    expect(html).toContain('80 %');
    expect(html).toMatch(/href="\/classes\/c1"[\s\S]*58 %[\s\S]*href="\/classes\/c2"[\s\S]*91 %/);
  });

  it('caja muestra el cierre por medio en cards, con lo corregido', () => {
    const html = renderToStaticMarkup(<Cash data={data} exportHref="/csv" />);
    expect(html.match(/cash-closing-card/g)).toHaveLength(4);
    expect(html).toMatch(/data-method="CASH"[\s\S]*Corregido[\s\S]*antes[\s\S]*Faltan/);
    expect(html).toMatch(/data-method="CARD"[\s\S]*Sobran/);
    expect(html).toContain('Sin diferencia');
    expect(html).toContain('adriana');
  });

  it('alumnos mantiene la tabla con etiquetas para el celular', () => {
    const html = renderToStaticMarkup(
      <Students data={data} exportHref="/csv" query={query} search={search} />,
    );
    expect(html).toContain('data-label="Alumno"');
    expect(html).toContain('Gómez, Lucía');
  });
});
