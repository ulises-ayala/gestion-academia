import { Prisma } from '@academy/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import { ReceivablesService } from './receivables.service';

describe('ReceivablesService', () => {
  afterEach(() => vi.useRealTimers());

  it.each(['pending', 'overdue'] as const)('aggregates and paginates %s debtors', async (scope) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T02:30:00.000Z'));
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        { totalStudents: 1n, totalCharges: 2n, totalAmount: new Prisma.Decimal('80000') },
      ])
      .mockResolvedValueOnce([
        {
          studentId: 'id',
          dni: '123',
          firstName: 'Ana',
          lastName: 'Pérez',
          pendingCount: 2n,
          overdueCount: 2n,
          totalPending: new Prisma.Decimal('80000'),
          oldestDueDate: new Date('2026-07-10T00:00:00Z'),
        },
      ]);
    const result = await new ReceivablesService({
      $queryRaw: queryRaw,
    } as unknown as PrismaService).list(scope, 2, 20);
    expect(result).toMatchObject({
      scope,
      totalStudents: 1,
      totalCharges: 2,
      totalAmount: '80000.00',
      page: 2,
      pageSize: 20,
    });
    expect(result.items[0]).toMatchObject({
      pendingCount: 2,
      totalPending: '80000.00',
      oldestDueDate: '2026-07-10',
    });
    const queries = queryRaw.mock.calls
      .map(([sql]) => (sql as { strings: readonly string[] }).strings.join(' '))
      .join(' ');
    expect(queries).toContain("status IN ('PENDING', 'PARTIAL')");
    if (scope === 'overdue') expect(queries).toContain('due_date <');
  });

  it('returns decimal zero and an empty page', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        { totalStudents: 0n, totalCharges: 0n, totalAmount: new Prisma.Decimal(0) },
      ])
      .mockResolvedValueOnce([]);
    const result = await new ReceivablesService({
      $queryRaw: queryRaw,
    } as unknown as PrismaService).list('pending', 1, 20);
    expect(result.totalAmount).toBe('0.00');
    expect(result.items).toEqual([]);
  });
});
