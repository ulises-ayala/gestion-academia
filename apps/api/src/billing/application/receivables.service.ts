import type { ReceivablesDto, ReceivablesScopeDto, ReceivablesSortDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { businessDayAt } from '../../dashboard/application/business-day';

type SummaryRow = {
  totalStudents: bigint;
  totalCharges: bigint;
  overdueCharges: bigint;
  partialCharges: bigint;
  totalOriginal: Prisma.Decimal | null;
  totalPaid: Prisma.Decimal | null;
  totalOutstanding: Prisma.Decimal | null;
};
type DebtorRow = {
  studentId: string;
  dni: string;
  firstName: string;
  lastName: string;
  openChargeCount: bigint;
  overdueChargeCount: bigint;
  partialChargeCount: bigint;
  oldestDueDate: Date;
  originalAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  outstandingAmount: Prisma.Decimal;
};

export type ReceivablesQuery = Readonly<{
  scope: ReceivablesScopeDto;
  q?: string;
  sort: ReceivablesSortDto;
  page: number;
  pageSize: number;
}>;

@Injectable()
export class ReceivablesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ReceivablesQuery): Promise<ReceivablesDto> {
    const today = businessDayAt(
      new Date(),
      process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires',
    ).dateValue;
    const scopeFilter = this.scopeFilter(query.scope, today);
    const searchFilter = query.q
      ? Prisma.sql`AND (
          s.first_name ILIKE ${`%${query.q}%`}
          OR s.last_name ILIKE ${`%${query.q}%`}
          OR CONCAT_WS(' ', s.first_name, s.last_name) ILIKE ${`%${query.q}%`}
          OR CONCAT_WS(' ', s.last_name, s.first_name) ILIKE ${`%${query.q}%`}
          OR s.dni ILIKE ${`%${query.q.replace(/\D/g, '') || query.q}%`}
          OR COALESCE(s.phone, '') ILIKE ${`%${query.q}%`}
        )`
      : Prisma.empty;
    const orderBy =
      query.sort === 'highest-debt'
        ? Prisma.sql`SUM(fc.outstanding) DESC, MIN(fc.due_date), s.last_name, s.first_name`
        : query.sort === 'name'
          ? Prisma.sql`s.last_name, s.first_name, s.id`
          : Prisma.sql`MIN(fc.due_date), s.last_name, s.first_name, s.id`;
    const filteredCharges = Prisma.sql`
      SELECT oc.*
      FROM open_charges oc
      JOIN students s ON s.id = oc.student_id
      WHERE oc.outstanding > 0 ${scopeFilter} ${searchFilter}
    `;
    const baseCtes = Prisma.sql`
      WITH confirmed AS (
        SELECT pa.monthly_charge_id, SUM(pa.amount) AS paid
        FROM payment_allocations pa
        JOIN payments p ON p.id = pa.payment_id AND p.status = 'CONFIRMED'
        GROUP BY pa.monthly_charge_id
      ), adjustment_totals AS (
        SELECT monthly_charge_id,
               SUM(student_amount_delta) AS student_delta,
               BOOL_OR(type = 'LATE_FEE') AS has_late_fee
        FROM monthly_charge_adjustments GROUP BY monthly_charge_id
      ), calculated AS (
        SELECT mc.*, COALESCE(c.paid, 0) AS confirmed_paid,
               GREATEST(mc.base_amount + COALESCE(a.student_delta, 0), 0) AS adjusted_due,
               COALESCE(a.has_late_fee, false) AS has_late_fee
        FROM monthly_charges mc
        LEFT JOIN confirmed c ON c.monthly_charge_id = mc.id
        LEFT JOIN adjustment_totals a ON a.monthly_charge_id = mc.id
        WHERE mc.status <> 'VOID'
      ), open_charges AS (
        SELECT id, student_id, due_date,
               CASE WHEN confirmed_paid = 0 THEN 'PENDING' ELSE 'PARTIAL' END AS status,
               adjusted_due + CASE WHEN due_date < ${today} AND NOT has_late_fee
                 AND adjusted_due - confirmed_paid > 0 THEN 1000 ELSE 0 END AS final_amount,
               LEAST(confirmed_paid, adjusted_due + CASE WHEN due_date < ${today} AND NOT has_late_fee
                 AND adjusted_due - confirmed_paid > 0 THEN 1000 ELSE 0 END) AS paid,
               GREATEST(adjusted_due + CASE WHEN due_date < ${today} AND NOT has_late_fee
                 AND adjusted_due - confirmed_paid > 0 THEN 1000 ELSE 0 END - confirmed_paid, 0) AS outstanding
        FROM calculated
      ), filtered_charges AS (${filteredCharges})
    `;
    const [summaryRows, items] = await Promise.all([
      this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
        ${baseCtes}
        SELECT COUNT(DISTINCT student_id) AS "totalStudents",
               COUNT(*) AS "totalCharges",
               COUNT(*) FILTER (WHERE due_date < ${today}) AS "overdueCharges",
               COUNT(*) FILTER (WHERE status = 'PARTIAL') AS "partialCharges",
               COALESCE(SUM(final_amount), 0) AS "totalOriginal",
               COALESCE(SUM(paid), 0) AS "totalPaid",
               COALESCE(SUM(outstanding), 0) AS "totalOutstanding"
        FROM filtered_charges
      `),
      this.prisma.$queryRaw<DebtorRow[]>(Prisma.sql`
        ${baseCtes}
        SELECT s.id AS "studentId", s.dni, s.first_name AS "firstName",
               s.last_name AS "lastName",
               COUNT(*) AS "openChargeCount",
               COUNT(*) FILTER (WHERE fc.due_date < ${today}) AS "overdueChargeCount",
               COUNT(*) FILTER (WHERE fc.status = 'PARTIAL') AS "partialChargeCount",
               MIN(fc.due_date) AS "oldestDueDate",
               SUM(fc.final_amount) AS "originalAmount",
               SUM(fc.paid) AS "paidAmount",
               SUM(fc.outstanding) AS "outstandingAmount"
        FROM filtered_charges fc
        JOIN students s ON s.id = fc.student_id
        GROUP BY s.id, s.dni, s.first_name, s.last_name
        ORDER BY ${orderBy}
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
      `),
    ]);
    const summary = summaryRows[0] ?? {
      totalStudents: 0n,
      totalCharges: 0n,
      overdueCharges: 0n,
      partialCharges: 0n,
      totalOriginal: null,
      totalPaid: null,
      totalOutstanding: null,
    };
    return {
      scope: query.scope,
      sort: query.sort,
      summary: {
        totalStudents: Number(summary.totalStudents),
        totalCharges: Number(summary.totalCharges),
        overdueCharges: Number(summary.overdueCharges),
        partialCharges: Number(summary.partialCharges),
        totalOriginal: summary.totalOriginal?.toFixed(2) ?? '0.00',
        totalPaid: summary.totalPaid?.toFixed(2) ?? '0.00',
        totalOutstanding: summary.totalOutstanding?.toFixed(2) ?? '0.00',
      },
      items: items.map((item) => ({
        student: {
          id: item.studentId,
          dni: item.dni,
          firstName: item.firstName,
          lastName: item.lastName,
        },
        openChargeCount: Number(item.openChargeCount),
        overdueChargeCount: Number(item.overdueChargeCount),
        partialChargeCount: Number(item.partialChargeCount),
        oldestDueDate: item.oldestDueDate.toISOString().slice(0, 10),
        originalAmount: item.originalAmount.toFixed(2),
        paidAmount: item.paidAmount.toFixed(2),
        outstandingAmount: item.outstandingAmount.toFixed(2),
      })),
      total: Number(summary.totalStudents),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private scopeFilter(scope: ReceivablesScopeDto, today: Date) {
    if (scope === 'overdue') return Prisma.sql`AND oc.due_date < ${today}`;
    if (scope === 'partial') return Prisma.sql`AND oc.status = 'PARTIAL'`;
    if (scope === 'unpaid') return Prisma.sql`AND oc.status = 'PENDING' AND oc.paid = 0`;
    return Prisma.empty;
  }
}
