import type { ReceivablesDto, ReceivablesScopeDto } from '@academy/contracts';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@academy/database';
import { PrismaService } from '../../database/prisma.service';
import { businessDayAt } from '../../dashboard/application/business-day';

type SummaryRow = {
  totalStudents: bigint;
  totalCharges: bigint;
  totalAmount: Prisma.Decimal | null;
};
type DebtorRow = {
  studentId: string;
  dni: string;
  firstName: string;
  lastName: string;
  pendingCount: bigint;
  overdueCount: bigint;
  totalPending: Prisma.Decimal;
  oldestDueDate: Date;
};

@Injectable()
export class ReceivablesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: ReceivablesScopeDto, page: number, pageSize: number): Promise<ReceivablesDto> {
    const today = businessDayAt(
      new Date(),
      process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires',
    ).dateValue;
    const scopeFilter = scope === 'overdue' ? Prisma.sql`AND due_date < ${today}` : Prisma.empty;
    const [summaryRows, items] = await Promise.all([
      this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
        WITH confirmed AS (
          SELECT pa.monthly_charge_id, SUM(pa.amount) AS paid
          FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id AND p.status = 'CONFIRMED'
          GROUP BY pa.monthly_charge_id
        ), open_charges AS (
          SELECT mc.student_id, mc.due_date,
                 GREATEST(mc.final_amount - COALESCE(c.paid, 0), 0) AS outstanding
          FROM monthly_charges mc LEFT JOIN confirmed c ON c.monthly_charge_id = mc.id
          WHERE mc.status IN ('PENDING', 'PARTIAL')
        )
        SELECT COUNT(DISTINCT student_id) AS "totalStudents",
               COUNT(*) AS "totalCharges",
               COALESCE(SUM(outstanding), 0) AS "totalAmount"
        FROM open_charges WHERE outstanding > 0 ${scopeFilter}
      `),
      this.prisma.$queryRaw<DebtorRow[]>(Prisma.sql`
        WITH confirmed AS (
          SELECT pa.monthly_charge_id, SUM(pa.amount) AS paid
          FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id AND p.status = 'CONFIRMED'
          GROUP BY pa.monthly_charge_id
        ), open_charges AS (
          SELECT mc.student_id, mc.due_date,
                 GREATEST(mc.final_amount - COALESCE(c.paid, 0), 0) AS outstanding
          FROM monthly_charges mc LEFT JOIN confirmed c ON c.monthly_charge_id = mc.id
          WHERE mc.status IN ('PENDING', 'PARTIAL')
        )
        SELECT s.id AS "studentId", s.dni, s.first_name AS "firstName", s.last_name AS "lastName",
               COUNT(*) AS "pendingCount",
               COUNT(*) FILTER (WHERE oc.due_date < ${today}) AS "overdueCount",
               SUM(oc.outstanding) AS "totalPending",
               MIN(oc.due_date) AS "oldestDueDate"
        FROM open_charges oc
        JOIN students s ON s.id = oc.student_id
        WHERE oc.outstanding > 0 ${scopeFilter}
        GROUP BY s.id, s.dni, s.first_name, s.last_name
        ORDER BY MIN(oc.due_date), s.last_name, s.first_name
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `),
    ]);
    const summary = summaryRows[0] ?? { totalStudents: 0n, totalCharges: 0n, totalAmount: null };
    return {
      scope,
      totalStudents: Number(summary.totalStudents),
      totalCharges: Number(summary.totalCharges),
      totalAmount: summary.totalAmount?.toFixed(2) ?? '0.00',
      items: items.map((item) => ({
        student: {
          id: item.studentId,
          dni: item.dni,
          firstName: item.firstName,
          lastName: item.lastName,
        },
        pendingCount: Number(item.pendingCount),
        overdueCount: Number(item.overdueCount),
        totalPending: item.totalPending.toFixed(2),
        oldestDueDate: item.oldestDueDate.toISOString().slice(0, 10),
      })),
      page,
      pageSize,
    };
  }
}
