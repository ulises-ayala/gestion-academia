import type { OperationalReportsDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import {
  PDF_DEBTOR_LIMIT,
  formatDate,
  formatDateInZone,
  formatMoney,
  renderOperationalReportPdf,
  reportPdfFileName,
} from './report-pdf';

const options = {
  timezone: 'America/Buenos_Aires',
  debtSort: 'highest',
  classFiltered: false,
} as const;
const page = <T>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 20 });

const report = (overrides: Partial<OperationalReportsDto> = {}): OperationalReportsDto => ({
  generatedAt: '2026-10-18T22:30:00.000Z',
  businessDate: '2026-10-18',
  from: '2026-10-01',
  to: '2026-10-18',
  summary: {
    activeStudents: 120,
    inactiveStudents: 14,
    newStudents: 9,
    pendingDebt: '254000.00',
    overdueCharges: 11,
    overdueDebt: '98000.00',
    collectedAmount: '1830500.50',
    confirmedPayments: 87,
    closedCashShifts: 15,
    cashDifference: '-1500.00',
  },
  students: page([]),
  collections: {
    total: '1830500.50',
    count: 87,
    byMethod: [
      { method: 'CASH', amount: '830500.50' },
      { method: 'MERCADO_PAGO', amount: '900000.00' },
      { method: 'CARD', amount: '100000.00' },
    ],
    byDay: [
      { date: '2026-10-01', amount: '120000.00' },
      { date: '2026-10-02', amount: '0.00' },
    ],
    byConcept: { charges: '1800500.50', singleClass: '24000.00', other: '6000.00' },
    singleClasses: [
      {
        classId: 'c1',
        className: 'Zumba',
        teacherId: 't1',
        teacherName: 'Jose Luis Barrios',
        count: 3,
        amount: '24000.00',
      },
    ],
    byTeacher: [
      {
        teacherId: 't1',
        teacherName: 'Jose Luis Barrios',
        charges: '520000.00',
        historicalDebt: '100000.00',
        singleClass: '24000.00',
        singleClassCount: 3,
        total: '644000.00',
      },
    ],
  },
  debtors: page([
    {
      studentId: 's1',
      firstName: 'Ana',
      lastName: 'Pérez',
      dni: '30111222',
      openCharges: 2,
      overdueCharges: 1,
      totalDebt: '36000.00',
      overdueDebt: '18000.00',
      oldestDueDate: '2026-09-10',
    },
  ]),
  attendance: {
    records: 40,
    present: 32,
    absent: 6,
    justified: 2,
    byClass: [
      {
        classId: 'c1',
        className: 'Bachata y Salsa Inicial',
        teacherName: 'José Luis Barrios',
        records: 40,
        present: 32,
        absent: 6,
        justified: 2,
      },
    ],
  },
  cash: {
    closedShifts: 1,
    openShifts: 0,
    byMethod: [
      {
        method: 'CASH',
        expected: '1000.00',
        declared: '900.00',
        difference: '-100.00',
        correctedDeclared: '1000.00',
        correctedDifference: '0.00',
      },
    ],
    byOperator: [
      {
        userId: 'u1',
        username: 'recepcion',
        shifts: 1,
        expected: '1000.00',
        declared: '900.00',
        difference: '-100.00',
        correctedDifference: '0.00',
      },
    ],
    differences: [
      {
        shiftId: 'sh1',
        closedAt: '2026-10-05T23:00:00.000Z',
        username: 'recepcion',
        difference: '-100.00',
        correctedDifference: '0.00',
      },
    ],
  },
  ...overrides,
});

const pageCount = (pdf: Buffer) =>
  pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g)?.length ?? 0;

describe('renderOperationalReportPdf', () => {
  it('genera un PDF válido de una página con todos los resúmenes', async () => {
    const pdf = await renderOperationalReportPdf(report(), options);
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(1);
  });

  it('pagina tablas largas en varias hojas', async () => {
    const byClass = Array.from({ length: 120 }, (_, index) => ({
      classId: `c${index}`,
      className: `Clase ${index}`,
      teacherName: 'Profesora',
      records: 1,
      present: 1,
      absent: 0,
      justified: 0,
    }));
    const pdf = await renderOperationalReportPdf(
      report({ attendance: { records: 120, present: 120, absent: 0, justified: 0, byClass } }),
      options,
    );
    expect(pageCount(pdf)).toBeGreaterThan(2);
  });

  it('soporta un período sin movimientos', async () => {
    const empty = report({
      collections: {
        total: '0.00',
        count: 0,
        byMethod: [],
        byDay: [],
        byConcept: { charges: '0.00', singleClass: '0.00', other: '0.00' },
        singleClasses: [],
        byTeacher: [],
      },
      debtors: page([]),
      attendance: { records: 0, present: 0, absent: 0, justified: 0, byClass: [] },
      cash: { closedShifts: 0, openShifts: 0, byMethod: [], byOperator: [], differences: [] },
    });
    const pdf = await renderOperationalReportPdf(empty, options);
    expect(pdf.toString('latin1').startsWith('%PDF-')).toBe(true);
  });
});

describe('formatos del PDF', () => {
  it('usa fechas y montos argentinos y un nombre de archivo con el período', () => {
    expect(formatDate('2026-10-05T23:00:00.000Z')).toBe('05/10/2026');
    // Un cierre a las 23:30 de Argentina ya es el día siguiente en UTC.
    expect(formatDateInZone('2026-10-06T02:30:00.000Z', 'America/Buenos_Aires')).toBe('05/10/2026');
    expect(formatMoney('1830500.5').replace(/\s/g, ' ')).toBe('$ 1.830.500,50');
    expect(reportPdfFileName('2026-10-01', '2026-10-18')).toBe(
      'reporte-carmesi-2026-10-01_2026-10-18.pdf',
    );
    expect(PDF_DEBTOR_LIMIT).toBe(20);
  });
});
