import type { EnrollmentDto, MonthlyChargeDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import {
  buildChargeGrid,
  cellKey,
  missingDue,
  openCells,
  reminderText,
  shortMonth,
} from './charge-grid';

const enrollment = (
  id: string,
  className: string,
  over: Partial<EnrollmentDto> = {},
): EnrollmentDto =>
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
    ...over,
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

const paid = { paidAmount: '40000.00', outstandingAmount: '0.00', status: 'PAID' } as const;

describe('grilla de cuotas por clase y mes', () => {
  const enrollments = [enrollment('sal', 'Salsa'), enrollment('bac', 'Bachata')];
  const charges = [
    charge('bac', '2026-09', paid),
    charge('bac', '2026-10', { overdue: true }),
    charge('bac', '2026-11', {
      paidAmount: '15000.00',
      outstandingAmount: '25000.00',
      status: 'PARTIAL',
    }),
    charge('sal', '2026-09', paid),
    charge('sal', '2026-12'),
  ];
  const grid = buildChargeGrid({ enrollments, charges, currentPeriod: '2026-11' });

  it('arma una fila por clase y una columna por mes, desde que hay algo para mostrar', () => {
    // Las clases empezaron en septiembre: junio a agosto no se dibujan.
    expect(grid.periods).toEqual(['2026-09', '2026-10', '2026-11', '2026-12']);
    expect(grid.rows.map((row) => row.className)).toEqual(['Bachata', 'Salsa']);
    expect(grid.rows[0]!.cells.map((cell) => cell.state)).toEqual([
      'paid',
      'overdue',
      'partial',
      'missing',
    ]);
    expect(grid.rows[1]!.cells.map((cell) => cell.state)).toEqual([
      'paid',
      'missing',
      'missing',
      'pending',
    ]);
  });

  it('suma lo que debe por clase, por mes y en total', () => {
    expect(grid.rows.map((row) => row.outstanding)).toEqual([65000, 40000]);
    expect(grid.totals).toEqual([0, 40000, 25000, 40000]);
    expect(grid.outstanding).toBe(105000);
  });

  it('propone generar lo que falta hasta el mes actual, no lo adelantado', () => {
    expect(missingDue(grid)).toEqual([
      { enrollmentId: 'sal', period: '2026-10' },
      { enrollmentId: 'sal', period: '2026-11' },
    ]);
    expect(openCells(grid).map((item) => item.id)).toEqual([
      'bac-2026-10',
      'bac-2026-11',
      'sal-2026-12',
    ]);
    expect(cellKey('sal', '2026-10')).toBe('sal|2026-10');
  });

  it('una inscripción terminada solo aparece si dejó deuda, y no se le genera nada', () => {
    const ended = enrollment('kiz', 'Kizomba', {
      status: 'ENDED' as EnrollmentDto['status'],
      endDate: '2026-10-31',
    });
    const without = buildChargeGrid({
      enrollments: [ended],
      charges: [],
      currentPeriod: '2026-11',
    });
    expect(without.rows).toEqual([]);
    const withDebt = buildChargeGrid({
      enrollments: [ended],
      charges: [charge('kiz', '2026-10', { overdue: true })],
      currentPeriod: '2026-11',
    });
    expect(withDebt.rows[0]).toMatchObject({ className: 'Kizomba', ended: true });
    expect(withDebt.rows[0]!.cells.map((cell) => cell.state)).not.toContain('missing');
  });

  it('se estira hasta la deuda más vieja y deja aparte la deuda anterior al sistema', () => {
    const old = buildChargeGrid({
      enrollments: [enrollment('bac', 'Bachata', { startDate: '2025-03-01' })],
      charges: [
        charge('bac', '2026-02', { overdue: true }),
        charge('bac', '2025-01', {
          kind: 'HISTORICAL_DEBT' as MonthlyChargeDto['kind'],
          description: 'Deuda 2025',
          outstandingAmount: '30000.00',
        }),
        charge('bac', '2026-10', { status: 'VOID' as MonthlyChargeDto['status'] }),
      ],
      currentPeriod: '2026-11',
    });
    expect(old.periods[0]).toBe('2026-02');
    expect(old.historicalDebt.map((item) => item.description)).toEqual(['Deuda 2025']);
    expect(old.outstanding).toBe(70000);
    // La cuota anulada no cuenta: octubre queda sin generar.
    expect(old.rows[0]!.cells.find((cell) => cell.period === '2026-10')!.state).toBe('missing');
  });

  it('nombra el mes corto, con el año si no es el actual', () => {
    expect(shortMonth('2026-11', '2026-11')).toBe('Nov');
    expect(shortMonth('2025-12', '2026-11')).toBe('Dic 25');
  });

  it('arma el recordatorio separado por clase y mes, solo con lo generado', () => {
    // Los importes llevan un espacio duro después del signo.
    const text = reminderText('Ana', grid).replace(/\u00a0/g, ' ');
    expect(text).toContain('Hola Ana');
    expect(text).toContain('*Bachata*\n• Octubre: $ 40.000,00 (venció el 10/10)');
    expect(text).toContain('• Noviembre: $ 25.000,00 (resta de $ 40.000,00)');
    expect(text).toContain('*Salsa*\n• Diciembre: $ 40.000,00 (vence el 10/12)');
    expect(text).toContain('*Total: $ 105.000,00*');
    expect(
      reminderText('Ana', buildChargeGrid({ enrollments, charges: [], currentPeriod: '2026-11' })),
    ).toBe('');
  });
});
