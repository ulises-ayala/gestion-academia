import type { DayOfWeekDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { SelfCheckInRepository } from '../application/self-check-in.repository';

const isoTime = (value: Date) => value.toISOString().slice(11, 16);

@Injectable()
export class PrismaSelfCheckInRepository implements SelfCheckInRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findStudentByDni(dniCandidates: readonly string[]) {
    return this.prisma.student.findFirst({
      where: { dni: { in: [...dniCandidates] } },
      select: { id: true, firstName: true, lastName: true, status: true },
      orderBy: { status: 'asc' },
    });
  }

  async candidates(studentId: string, attendanceDate: Date, dayOfWeek: DayOfWeekDto) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        status: 'ACTIVE',
        startDate: { lte: attendanceDate },
        OR: [{ endDate: null }, { endDate: { gte: attendanceDate } }],
        class: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        class: {
          select: {
            name: true,
            schedules: {
              where: { status: 'ACTIVE', dayOfWeek },
              select: { startTime: true, endTime: true },
            },
          },
        },
        attendances: { where: { attendanceDate }, select: { status: true }, take: 1 },
      },
    });
    return enrollments.flatMap((enrollment) =>
      enrollment.class.schedules.map((schedule) => ({
        enrollmentId: enrollment.id,
        className: enrollment.class.name,
        startTime: isoTime(schedule.startTime),
        endTime: isoTime(schedule.endTime),
        attendanceStatus: enrollment.attendances[0]?.status ?? null,
      })),
    );
  }

  async markPresent(enrollmentId: string, attendanceDate: Date) {
    await this.prisma.studentAttendance.upsert({
      where: { enrollmentId_attendanceDate: { enrollmentId, attendanceDate } },
      create: { enrollmentId, attendanceDate, status: 'PRESENT' },
      update: { status: 'PRESENT' },
    });
  }

  async hasOverdueCharges(studentId: string, businessDate: Date) {
    const [row] = await this.prisma.$queryRaw<{ overdue: boolean }[]>(Prisma.sql`
      WITH confirmed AS (
        SELECT pa.monthly_charge_id, SUM(pa.amount) AS paid
        FROM payment_allocations pa
        JOIN payments p ON p.id = pa.payment_id AND p.status = 'CONFIRMED'
        JOIN monthly_charges mc ON mc.id = pa.monthly_charge_id AND mc.student_id = ${studentId}::uuid
        GROUP BY pa.monthly_charge_id
      ), adjustments AS (
        SELECT mca.monthly_charge_id, SUM(mca.student_amount_delta) AS delta
        FROM monthly_charge_adjustments mca
        JOIN monthly_charges mc ON mc.id = mca.monthly_charge_id AND mc.student_id = ${studentId}::uuid
        GROUP BY mca.monthly_charge_id
      )
      SELECT EXISTS (
        SELECT 1
        FROM monthly_charges mc
        LEFT JOIN confirmed c ON c.monthly_charge_id = mc.id
        LEFT JOIN adjustments a ON a.monthly_charge_id = mc.id
        WHERE mc.student_id = ${studentId}::uuid
          AND mc.status <> 'VOID'
          AND mc.due_date < ${businessDate}
          AND GREATEST(mc.base_amount + COALESCE(a.delta, 0), 0) - COALESCE(c.paid, 0) > 0
      ) AS overdue
    `);
    return Boolean(row?.overdue);
  }
}
