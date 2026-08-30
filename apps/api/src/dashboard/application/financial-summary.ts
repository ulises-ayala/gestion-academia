import { Prisma } from '@academy/database';
import { businessDayAt } from './business-day';

const shortMonths = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];
const fullMonths = [
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

export type ConfirmedPaymentMonthRow = Readonly<{
  year: number;
  month: number;
  amount: Prisma.Decimal;
}>;

export const confirmedPaymentMonthsAt = (now: Date, timeZone: string) => {
  const current = businessDayAt(now, timeZone);
  const [year, month] = current.date.split('-').map(Number);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year!, month! - 1 - (5 - index), 1));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
  });
  const startMonth = months[0]!;
  const afterCurrent = new Date(Date.UTC(year!, month!, 1));
  return {
    months,
    start: businessDayAt(
      new Date(`${startMonth.year}-${String(startMonth.month).padStart(2, '0')}-01T12:00:00.000Z`),
      timeZone,
    ).start,
    end: businessDayAt(
      new Date(
        `${afterCurrent.getUTCFullYear()}-${String(afterCurrent.getUTCMonth() + 1).padStart(2, '0')}-01T12:00:00.000Z`,
      ),
      timeZone,
    ).start,
  };
};

export const buildFinancialSummary = (
  months: readonly Readonly<{ year: number; month: number }>[],
  rows: readonly ConfirmedPaymentMonthRow[],
) => {
  const monthlyConfirmed = months.map(({ year, month }) => {
    const amount =
      rows.find((row) => Number(row.year) === year && Number(row.month) === month)?.amount ??
      new Prisma.Decimal(0);
    return {
      year,
      month,
      label: shortMonths[month - 1]!,
      fullLabel: `${fullMonths[month - 1]} ${year}`,
      amount: amount.toFixed(2),
    };
  });
  const current = new Prisma.Decimal(monthlyConfirmed.at(-1)!.amount);
  const previous = new Prisma.Decimal(monthlyConfirmed.at(-2)!.amount);
  const total = monthlyConfirmed.reduce(
    (sum, item) => sum.plus(item.amount),
    new Prisma.Decimal(0),
  );
  return {
    currentMonthConfirmed: current.toFixed(2),
    previousMonthConfirmed: previous.toFixed(2),
    variationPercent: previous.isZero()
      ? null
      : current.minus(previous).dividedBy(previous).times(100).toFixed(1),
    lastSixMonthsConfirmed: total.toFixed(2),
    monthlyConfirmed,
  };
};
