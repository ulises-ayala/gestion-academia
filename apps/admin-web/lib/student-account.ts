import type { AttendanceDto, EnrollmentDto, MonthlyChargeDto } from '@academy/contracts';

export type StudentAccountSummary = Readonly<{
  activeClasses: number;
  pendingDebt: string;
  overdueCharges: number;
  totalPaid: string;
}>;

const decimalToCents = (value: string) => {
  const [whole = '0', decimal = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0').slice(0, 2));
};
const centsToDecimal = (value: bigint) =>
  `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;

export function studentAccountSummary(
  enrollments: readonly EnrollmentDto[],
  charges: readonly MonthlyChargeDto[],
  confirmedPaymentTotal: string,
  today: string,
): StudentAccountSummary {
  const pending = charges.filter(
    (charge) => charge.status === 'PENDING' || charge.status === 'PARTIAL',
  );
  return {
    activeClasses: enrollments.filter((item) => item.status === 'ACTIVE').length,
    pendingDebt: centsToDecimal(
      pending.reduce((total, charge) => total + decimalToCents(charge.outstandingAmount), 0n),
    ),
    overdueCharges: pending.filter((charge) => charge.overdue || charge.dueDate < today).length,
    totalPaid: centsToDecimal(decimalToCents(confirmedPaymentTotal)),
  };
}

export const isOverdueCharge = (charge: MonthlyChargeDto, today: string) =>
  (charge.status === 'PENDING' || charge.status === 'PARTIAL') &&
  (charge.overdue || charge.dueDate < today);
export const sortAccountCharges = (charges: readonly MonthlyChargeDto[], today: string) =>
  [...charges].sort((left, right) => {
    const rank = (charge: MonthlyChargeDto) =>
      isOverdueCharge(charge, today)
        ? 0
        : charge.status === 'PENDING' || charge.status === 'PARTIAL'
          ? 1
          : charge.status === 'PAID'
            ? 2
            : 3;
    return (
      rank(left) - rank(right) ||
      right.period.localeCompare(left.period) ||
      right.dueDate.localeCompare(left.dueDate)
    );
  });
export const attendanceCounts = (items: readonly AttendanceDto[]) => ({
  present: items.filter((item) => item.status === 'PRESENT').length,
  absent: items.filter((item) => item.status === 'ABSENT').length,
  justified: items.filter((item) => item.status === 'JUSTIFIED').length,
});
