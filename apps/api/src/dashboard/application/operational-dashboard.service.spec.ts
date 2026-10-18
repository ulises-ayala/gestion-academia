import { Prisma } from '@academy/database';
import { describe, expect, it, vi } from 'vitest';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import type { PrismaService } from '../../database/prisma.service';
import { OperationalDashboardService } from './operational-dashboard.service';

const user = (role: PublicAuthUser['role']): PublicAuthUser => ({
  id: '00000000-0000-4000-8000-000000000001',
  username: role.toLowerCase(),
  role,
  status: 'ACTIVE',
});

const prismaMock = () => ({
  $queryRaw: vi.fn().mockImplementation((sql: { strings: readonly string[] }) =>
    Promise.resolve(
      sql.strings.join(' ').includes('open_charges')
        ? [
            {
              pendingCharges: 3n,
              pendingDebt: new Prisma.Decimal('1500.00'),
              overdueCharges: 2n,
              overdueStudents: 1n,
            },
          ]
        : sql.strings.join(' ').includes('COUNT(DISTINCT "studentId")')
          ? [{ students: 2n }]
          : [],
    ),
  ),
  student: { count: vi.fn().mockResolvedValue(12) },
  academyClass: {
    count: vi.fn().mockResolvedValue(4),
    findMany: vi.fn().mockResolvedValue([]),
  },
  enrollment: { groupBy: vi.fn().mockResolvedValue([]) },
  monthlyCharge: {
    aggregate: vi.fn().mockResolvedValue({
      _count: { id: 3 },
      _sum: { finalAmount: new Prisma.Decimal('1500.00') },
    }),
    count: vi.fn().mockResolvedValue(2),
  },
  payment: {
    aggregate: vi.fn().mockResolvedValue({
      _count: { id: 2 },
      _sum: { amount: new Prisma.Decimal('800.00') },
    }),
  },
  studentAttendance: { findMany: vi.fn().mockResolvedValue([]) },
  lead: {
    groupBy: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
  },
  auditLog: { findMany: vi.fn().mockResolvedValue([]) },
});

describe('OperationalDashboardService', () => {
  it('returns operational sections but never queries audit for Reception', async () => {
    const prisma = prismaMock();
    const service = new OperationalDashboardService(prisma as unknown as PrismaService);
    const result = await service.get(user('RECEPTION'), new Date('2026-08-30T15:00:00.000Z'));

    expect(result.students?.active).toBe(12);
    expect(result.billing).toEqual({
      pendingCharges: 3,
      pendingDebt: '1500.00',
      overdueCharges: 2,
      overdueStudents: 1,
    });
    expect(result.audit).toBeUndefined();
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(result.followUp).toEqual({ students: 2 });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'CONFIRMED' }),
      }),
    );
  });

  it('includes only the five latest audit entries for Management', async () => {
    const prisma = prismaMock();
    const service = new OperationalDashboardService(prisma as unknown as PrismaService);
    const result = await service.get(user('MANAGER'), new Date('2026-08-30T15:00:00.000Z'));

    expect(result.audit).toEqual({ items: [] });
    expect(result.financial?.monthlyConfirmed).toHaveLength(6);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    const financialQuery = prisma.$queryRaw.mock.calls
      .map(([query]) => query as { strings: readonly string[] })
      .find((query) => query.strings.join(' ').includes('FROM payments'))!;
    expect(financialQuery.strings.join(' ')).toContain("status = 'CONFIRMED'");
    expect(financialQuery.strings.join(' ')).not.toContain("status = 'VOID'");
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    );
  });

  it('adds enrollment and attendance progress to today classes', async () => {
    const prisma = prismaMock();
    prisma.academyClass.findMany.mockResolvedValue([
      {
        id: 'class-1',
        name: 'Ballet inicial',
        teacher: { firstName: 'Valentina', lastName: 'Ruiz' },
        schedules: [
          {
            startTime: new Date('1970-01-01T10:00:00.000Z'),
            endTime: new Date('1970-01-01T11:00:00.000Z'),
            room: { name: 'Sala 2', branch: { name: 'Centro' } },
          },
        ],
      },
      {
        id: 'class-2',
        name: 'Contemporáneo',
        teacher: { firstName: 'Mariana', lastName: 'Gómez' },
        schedules: [
          {
            startTime: new Date('1970-01-01T17:00:00.000Z'),
            endTime: new Date('1970-01-01T18:00:00.000Z'),
            room: { name: 'Sala 1', branch: { name: 'Centro' } },
          },
        ],
      },
    ]);
    prisma.enrollment.groupBy.mockResolvedValue([{ classId: 'class-1', _count: { id: 18 } }]);
    prisma.studentAttendance.findMany.mockImplementation((args: { where: object }) =>
      Promise.resolve(
        'enrollment' in args.where
          ? [{ enrollment: { classId: 'class-1' } }, { enrollment: { classId: 'class-1' } }]
          : [],
      ),
    );
    const result = await new OperationalDashboardService(prisma as unknown as PrismaService).get(
      user('RECEPTION'),
      new Date('2026-08-30T15:00:00.000Z'),
    );

    expect(result.classes?.scheduledToday).toBe(2);
    expect(result.classes?.today).toEqual([
      expect.objectContaining({ id: 'class-1', enrolledStudents: 18, attendanceRecords: 2 }),
      expect.objectContaining({ id: 'class-2', enrolledStudents: 0, attendanceRecords: 0 }),
    ]);
    expect(prisma.enrollment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          classId: { in: ['class-1', 'class-2'] },
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('returns financial data to Direction', async () => {
    const prisma = prismaMock();
    const result = await new OperationalDashboardService(prisma as unknown as PrismaService).get(
      user('ADMINISTRATOR'),
      new Date('2026-08-30T15:00:00.000Z'),
    );
    expect(result.financial).toBeDefined();
  });
});
