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
    const scopeFilter = scope === 'overdue' ? Prisma.sql`AND mc.due_date < ${today}` : Prisma.empty;
    const [summaryRows, items] = await Promise.all([
      this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
        SELECT COUNT(DISTINCT mc.student_id) AS "totalStudents",
               COUNT(*) AS "totalCharges",
               COALESCE(SUM(mc.final_amount), 0) AS "totalAmount"
        FROM monthly_charges mc
        WHERE mc.status = 'PENDING' ${scopeFilter}
      `),
      this.prisma.$queryRaw<DebtorRow[]>(Prisma.sql`
        SELECT s.id AS "studentId", s.dni, s.first_name AS "firstName", s.last_name AS "lastName",
               COUNT(*) AS "pendingCount",
               COUNT(*) FILTER (WHERE mc.due_date < ${today}) AS "overdueCount",
               SUM(mc.final_amount) AS "totalPending",
               MIN(mc.due_date) AS "oldestDueDate"
        FROM monthly_charges mc
        JOIN students s ON s.id = mc.student_id
        WHERE mc.status = 'PENDING' ${scopeFilter}
        GROUP BY s.id, s.dni, s.first_name, s.last_name
        ORDER BY MIN(mc.due_date), s.last_name, s.first_name
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
