import type { OperationalDashboardDto } from '@academy/contracts';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@academy/database';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { hasPermissions } from '../../auth/domain/permissions';
import { PrismaService } from '../../database/prisma.service';
import { businessDayAt } from './business-day';
import {
  buildFinancialSummary,
  confirmedPaymentMonthsAt,
  type ConfirmedPaymentMonthRow,
} from './financial-summary';

const openLeadStatuses = ['INQUIRY', 'INTERESTED', 'TRIAL'] as const;
const time = (value: Date) => value.toISOString().slice(11, 16);

@Injectable()
export class OperationalDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: PublicAuthUser, now: Date): Promise<OperationalDashboardDto> {
    const day = businessDayAt(now, process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires');
    const result: Record<string, unknown> = {
      generatedAt: now.toISOString(),
      businessDate: day.date,
    };
    const financialRange = confirmedPaymentMonthsAt(
      now,
      process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires',
    );

    await Promise.all([
      hasPermissions(user, ['students:manage']) &&
        this.prisma.student.count({ where: { status: 'ACTIVE' } }).then((active) => {
          result.students = { active };
        }),
      hasPermissions(user, ['offering:read']) &&
        Promise.all([
          this.prisma.academyClass.count({ where: { status: 'ACTIVE' } }),
          this.prisma.academyClass.findMany({
            where: {
              status: 'ACTIVE',
              schedules: { some: { status: 'ACTIVE', dayOfWeek: day.dayOfWeek } },
            },
            select: {
              id: true,
              name: true,
              teacher: { select: { firstName: true, lastName: true } },
              schedules: {
                where: { status: 'ACTIVE', dayOfWeek: day.dayOfWeek },
                select: {
                  startTime: true,
                  endTime: true,
                  room: { select: { name: true, branch: { select: { name: true } } } },
                },
                orderBy: { startTime: 'asc' },
              },
            },
          }),
        ]).then(([active, classes]) => {
          const today = classes
            .flatMap((item) =>
              item.schedules.map((schedule) => ({
                id: item.id,
                name: item.name,
                startTime: time(schedule.startTime),
                endTime: time(schedule.endTime),
                teacher: `${item.teacher.firstName} ${item.teacher.lastName}`,
                room: schedule.room.name,
                branch: schedule.room.branch.name,
              })),
            )
            .sort((left, right) => left.startTime.localeCompare(right.startTime));
          result.classes = { active, scheduledToday: classes.length, today };
        }),
      hasPermissions(user, ['charges:read']) &&
        Promise.all([
          this.prisma.monthlyCharge.aggregate({
            where: { status: 'PENDING' },
            _count: { id: true },
            _sum: { finalAmount: true },
          }),
          this.prisma.monthlyCharge.count({
            where: { status: 'PENDING', dueDate: { lt: day.dateValue } },
          }),
        ]).then(([pending, overdueCharges]) => {
          result.billing = {
            pendingCharges: pending._count.id,
            pendingDebt: pending._sum.finalAmount?.toFixed(2) ?? '0.00',
            overdueCharges,
          };
        }),
      hasPermissions(user, ['payments:read']) &&
        this.prisma.payment
          .aggregate({
            where: { status: 'CONFIRMED', paidAt: { gte: day.start, lt: day.end } },
            _count: { id: true },
            _sum: { amount: true },
          })
          .then((payments) => {
            result.payments = {
              confirmedToday: payments._count.id,
              confirmedAmountToday: payments._sum.amount?.toFixed(2) ?? '0.00',
            };
          }),
      hasPermissions(user, ['reports:operational']) &&
        this.prisma
          .$queryRaw<ConfirmedPaymentMonthRow[]>(
            Prisma.sql`
            SELECT
              EXTRACT(YEAR FROM paid_at AT TIME ZONE ${process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires'})::int AS year,
              EXTRACT(MONTH FROM paid_at AT TIME ZONE ${process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires'})::int AS month,
              SUM(amount) AS amount
            FROM payments
            WHERE status = 'CONFIRMED'
              AND paid_at >= ${financialRange.start}
              AND paid_at < ${financialRange.end}
            GROUP BY year, month
            ORDER BY year, month
          `,
          )
          .then((rows) => {
            result.financial = buildFinancialSummary(financialRange.months, rows);
          }),
      hasPermissions(user, ['attendance:manage']) &&
        this.prisma.studentAttendance
          .findMany({
            where: { attendanceDate: day.dateValue },
            select: { status: true, enrollment: { select: { classId: true } } },
          })
          .then((items) => {
            result.attendance = {
              present: items.filter((item) => item.status === 'PRESENT').length,
              absent: items.filter((item) => item.status === 'ABSENT').length,
              justified: items.filter((item) => item.status === 'JUSTIFIED').length,
              classesWithRecords: new Set(items.map((item) => item.enrollment.classId)).size,
            };
          }),
      hasPermissions(user, ['leads:manage']) && this.loadLeads(result, day.start, day.end, now),
      hasPermissions(user, ['audit:read']) &&
        this.prisma.auditLog
          .findMany({
            take: 5,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: {
              id: true,
              action: true,
              entityType: true,
              entityId: true,
              createdAt: true,
              actor: { select: { username: true } },
            },
          })
          .then((items) => {
            result.audit = {
              items: items.map((item) => ({
                id: item.id,
                action: item.action,
                entityType: item.entityType,
                entityId: item.entityId,
                createdAt: item.createdAt.toISOString(),
                actorUsername: item.actor.username,
              })),
            };
          }),
    ]);
    return result as OperationalDashboardDto;
  }

  private async loadLeads(result: Record<string, unknown>, start: Date, end: Date, now: Date) {
    const [groups, followUpsToday, overdueFollowUps, priority] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.lead.count({
        where: { status: { in: [...openLeadStatuses] }, nextFollowUpAt: { gte: start, lt: end } },
      }),
      this.prisma.lead.count({
        where: { status: { in: [...openLeadStatuses] }, nextFollowUpAt: { lt: now } },
      }),
      this.prisma.lead.findMany({
        where: { status: { in: [...openLeadStatuses] }, nextFollowUpAt: { not: null } },
        orderBy: [{ nextFollowUpAt: 'asc' }, { updatedAt: 'desc' }],
        take: 5,
        select: { id: true, name: true, status: true, nextFollowUpAt: true },
      }),
    ]);
    const count = (status: string) =>
      groups.find((group) => group.status === status)?._count.id ?? 0;
    result.leads = {
      inquiry: count('INQUIRY'),
      interested: count('INTERESTED'),
      trial: count('TRIAL'),
      followUpsToday,
      overdueFollowUps,
      priority: priority.map((lead) => ({
        ...lead,
        nextFollowUpAt: lead.nextFollowUpAt!.toISOString(),
        overdue: lead.nextFollowUpAt! < now,
      })),
    };
  }
}
