import type { EnrollmentDto, MonthlyChargeDto } from '@academy/contracts';
import { GENERATION_MONTHS_AHEAD, addMonths } from './charge-generation';
import { dayMonth } from './dates';
import { money } from './money';

/**
 * Estado de la cuota de una clase en un mes:
 * pagada, con saldo (vencida, parcial o pendiente), sin generar, o fuera de la inscripción.
 */
export type GridCellState = 'paid' | 'overdue' | 'partial' | 'pending' | 'missing' | 'outside';

export type GridCell = Readonly<{
  period: string;
  state: GridCellState;
  /** La cuota del mes, si está generada. */
  charge: MonthlyChargeDto | null;
}>;

export type GridRow = Readonly<{
  enrollmentId: string;
  className: string;
  /** Modalidad (tarifa elegida), si la inscripción tiene una. */
  modality: string | null;
  ended: boolean;
  cells: readonly GridCell[];
  outstanding: number;
}>;

export type ChargeGrid = Readonly<{
  /** Meses de la grilla (AAAA-MM), del más viejo al más nuevo. */
  periods: readonly string[];
  currentPeriod: string;
  rows: readonly GridRow[];
  /** Lo que debe en cada mes, sumando sus clases; mismo orden que `periods`. */
  totals: readonly number[];
  outstanding: number;
  /** Deuda anterior al sistema: no pertenece a un mes, va aparte. */
  historicalDebt: readonly MonthlyChargeDto[];
}>;

const MONTHS_BACK = 5;
const MAX_MONTHS_BACK = 11;
const monthNames = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const monthName = (period: string) => monthNames[Number(period.slice(5, 7)) - 1]!;
/** "Nov" o, si no es del año en curso, "Dic 25". */
export const shortMonth = (period: string, currentPeriod: string) =>
  `${monthName(period).slice(0, 3)}${period.slice(0, 4) === currentPeriod.slice(0, 4) ? '' : ` ${period.slice(2, 4)}`}`;

export const cellKey = (enrollmentId: string, period: string) => `${enrollmentId}|${period}`;

const outstandingOf = (charge: MonthlyChargeDto) => Number(charge.outstandingAmount);
const isLive = (charge: MonthlyChargeDto) => charge.status !== 'VOID';

const stateOf = (charge: MonthlyChargeDto): GridCellState =>
  outstandingOf(charge) <= 0
    ? 'paid'
    : charge.overdue
      ? 'overdue'
      : charge.status === 'PARTIAL'
        ? 'partial'
        : 'pending';

/**
 * Cuotas del alumno por clase (fila) y mes (columna). Una celda sin cuota dentro de las fechas de
 * una inscripción activa queda "sin generar": es lo que Admisión puede generar desde la grilla.
 */
export const buildChargeGrid = (input: {
  enrollments: readonly EnrollmentDto[];
  charges: readonly MonthlyChargeDto[];
  currentPeriod: string;
}): ChargeGrid => {
  const { currentPeriod } = input;
  const monthly = input.charges.filter((charge) => charge.kind === 'MONTHLY' && isLive(charge));
  const open = monthly.filter((charge) => outstandingOf(charge) > 0);
  const last = addMonths(currentPeriod, GENERATION_MONTHS_AHEAD);
  const earliest = addMonths(currentPeriod, -MAX_MONTHS_BACK);
  // La grilla llega hasta la deuda más vieja (tope: un año) y hasta el mes que viene, o más si
  // ya hay cuotas adelantadas.
  const oldestOpen = open.reduce(
    (oldest, charge) => (charge.period.slice(0, 7) < oldest ? charge.period.slice(0, 7) : oldest),
    addMonths(currentPeriod, -MONTHS_BACK),
  );
  const from = oldestOpen < earliest ? earliest : oldestOpen;
  const newest = monthly.reduce(
    (latest, charge) => (charge.period.slice(0, 7) > latest ? charge.period.slice(0, 7) : latest),
    addMonths(currentPeriod, 1),
  );
  const until = newest > last ? last : newest;
  const allPeriods: string[] = [];
  for (let period = from; period <= until; period = addMonths(period, 1)) allPeriods.push(period);

  const rows = input.enrollments
    .filter(
      (enrollment) =>
        enrollment.status === 'ACTIVE' ||
        open.some((charge) => charge.enrollmentId === enrollment.id),
    )
    .map((enrollment) => {
      const active = enrollment.status === 'ACTIVE';
      const start = enrollment.startDate.slice(0, 7);
      const end = enrollment.endDate?.slice(0, 7) ?? null;
      const cells = allPeriods.map((period): GridCell => {
        const charge =
          monthly.find(
            (item) => item.enrollmentId === enrollment.id && item.period.slice(0, 7) === period,
          ) ?? null;
        if (charge) return { period, state: stateOf(charge), charge };
        const inside = active && period >= start && (end === null || period <= end);
        return { period, state: inside ? 'missing' : 'outside', charge: null };
      });
      return {
        enrollmentId: enrollment.id,
        className: enrollment.academicClass.name,
        modality: enrollment.tariff?.name ?? null,
        ended: !active,
        cells,
        outstanding: cells.reduce(
          (sum, cell) => sum + (cell.charge ? outstandingOf(cell.charge) : 0),
          0,
        ),
      };
    })
    .sort(
      (left, right) =>
        Number(left.ended) - Number(right.ended) ||
        left.className.localeCompare(right.className, 'es'),
    );

  // Los primeros meses sin nada que mostrar (todas las clases empezaron después) no se dibujan.
  const firstUseful = allPeriods.findIndex((_, index) =>
    rows.some((row) => row.cells[index]!.state !== 'outside'),
  );
  const skip = firstUseful < 0 ? Math.max(allPeriods.length - 2, 0) : firstUseful;
  const periods = allPeriods.slice(skip);
  const trimmed = rows.map((row) => ({ ...row, cells: row.cells.slice(skip) }));
  const historicalDebt = input.charges.filter(
    (charge) => charge.kind !== 'MONTHLY' && isLive(charge) && outstandingOf(charge) > 0,
  );
  return {
    periods,
    currentPeriod,
    rows: trimmed,
    totals: periods.map((_, index) =>
      trimmed.reduce((sum, row) => {
        const charge = row.cells[index]!.charge;
        return sum + (charge ? outstandingOf(charge) : 0);
      }, 0),
    ),
    outstanding:
      trimmed.reduce((sum, row) => sum + row.outstanding, 0) +
      historicalDebt.reduce((sum, charge) => sum + outstandingOf(charge), 0),
    historicalDebt,
  };
};

/** Celdas sin generar hasta el mes actual: las cuotas que el alumno ya debería tener. */
export const missingDue = (grid: ChargeGrid) =>
  grid.rows.flatMap((row) =>
    row.cells
      .filter((cell) => cell.state === 'missing' && cell.period <= grid.currentPeriod)
      .map((cell) => ({ enrollmentId: row.enrollmentId, period: cell.period })),
  );

/** Cuotas generadas con saldo, de la más vieja a la más nueva. */
export const openCells = (grid: ChargeGrid) =>
  grid.rows
    .flatMap((row) => row.cells)
    .flatMap((cell) => (cell.charge && outstandingOf(cell.charge) > 0 ? [cell.charge] : []));

/** Detalle de una celda con saldo, como se lee en la grilla y en el recordatorio. */
export const cellNote = (charge: MonthlyChargeDto) =>
  charge.overdue
    ? `venció el ${dayMonth(charge.dueDate)}`
    : charge.status === 'PARTIAL'
      ? `resta de ${money(charge.studentDueAmount)}`
      : `vence el ${dayMonth(charge.dueDate)}`;

/**
 * Recordatorio de WhatsApp con la deuda separada por clase y mes. Solo cuenta lo generado: un mes
 * sin cuota todavía no es deuda. Vacío si no debe nada.
 */
export const reminderText = (firstName: string, grid: ChargeGrid) => {
  const blocks = grid.rows.flatMap((row) => {
    const lines = row.cells.flatMap((cell) =>
      cell.charge && outstandingOf(cell.charge) > 0
        ? [
            `• ${monthName(cell.period)}: ${money(cell.charge.outstandingAmount)} (${cellNote(cell.charge)})`,
          ]
        : [],
    );
    return lines.length ? [`*${row.className}*\n${lines.join('\n')}`] : [];
  });
  for (const charge of grid.historicalDebt)
    blocks.push(
      `*${charge.academicClass.name}*\n• ${charge.description ?? 'Deuda anterior'}: ${money(charge.outstandingAmount)}`,
    );
  if (blocks.length === 0) return '';
  return [
    `Hola ${firstName} 👋 Te escribimos de *Carmesí*. Te pasamos el detalle de lo que nos figura pendiente:`,
    blocks.join('\n\n'),
    `*Total: ${money(grid.outstanding)}*`,
    'Podés abonar en la academia o por transferencia. Si ya pagaste, avisanos y lo revisamos. ¡Gracias! 💗',
  ].join('\n\n');
};
