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
  student: { count: vi.fn().mockResolvedValue(12) },
  academyClass: {
    count: vi.fn().mockResolvedValue(4),
    findMany: vi.fn().mockResolvedValue([]),
  },
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
    });
    expect(result.audit).toBeUndefined();
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
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
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    );
  });
});
