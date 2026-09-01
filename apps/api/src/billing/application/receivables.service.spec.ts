import type { ReceivablesScopeDto, ReceivablesSortDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import { ReceivablesService } from './receivables.service';

const summary = {
  totalStudents: 1n,
  totalCharges: 2n,
  overdueCharges: 1n,
  partialCharges: 1n,
  totalOriginal: new Prisma.Decimal('80000'),
  totalPaid: new Prisma.Decimal('10000'),
  totalOutstanding: new Prisma.Decimal('70000'),
};
const debtor = {
  studentId: 'id',
  dni: '30100100',
  firstName: 'Ana',
  lastName: 'Pérez',
  openChargeCount: 2n,
  overdueChargeCount: 1n,
  partialChargeCount: 1n,
  oldestDueDate: new Date('2026-07-10T00:00:00Z'),
  originalAmount: new Prisma.Decimal('80000'),
  paidAmount: new Prisma.Decimal('10000'),
  outstandingAmount: new Prisma.Decimal('70000'),
};

const run = async (scope: ReceivablesScopeDto, sort: ReceivablesSortDto = 'oldest', q?: string) => {
  const queryRaw = vi.fn().mockResolvedValueOnce([summary]).mockResolvedValueOnce([debtor]);
  const result = await new ReceivablesService({
    $queryRaw: queryRaw,
  } as unknown as PrismaService).list({
    scope,
    sort,
    ...(q ? { q } : {}),
    page: 2,
    pageSize: 25,
  });
  const sql = queryRaw.mock.calls
    .map(([query]) => (query as { strings: readonly string[] }).strings.join(' '))
    .join(' ');
  return { result, sql };
};

describe('ReceivablesService', () => {
  afterEach(() => vi.useRealTimers());

  it('returns a global summary and groups real outstanding amounts by student', async () => {
    const { result, sql } = await run('pending');
    expect(result).toMatchObject({
      scope: 'pending',
      sort: 'oldest',
      summary: {
        totalStudents: 1,
        totalCharges: 2,
        overdueCharges: 1,
        partialCharges: 1,
        totalOriginal: '80000.00',
        totalPaid: '10000.00',
        totalOutstanding: '70000.00',
      },
      total: 1,
      page: 2,
      pageSize: 25,
    });
    expect(result.items[0]).toMatchObject({
      openChargeCount: 2,
      overdueChargeCount: 1,
      partialChargeCount: 1,
      paidAmount: '10000.00',
      outstandingAmount: '70000.00',
      oldestDueDate: '2026-07-10',
    });
    expect(sql).toContain("p.status = 'CONFIRMED'");
    expect(sql).toContain("mc.status <> 'VOID'");
    expect(sql).toContain('student_amount_delta');
    expect(sql).toContain('LIMIT');
    expect(sql).toContain('OFFSET');
  });

  it.each([
    ['overdue', 'oc.due_date <'],
    ['partial', "oc.status = 'PARTIAL'"],
    ['unpaid', "oc.status = 'PENDING' AND oc.paid = 0"],
  ] as const)('applies the %s scope server-side', async (scope, fragment) => {
    expect((await run(scope)).sql).toContain(fragment);
  });

  it('searches name, full name, DNI and phone server-side', async () => {
    const { sql } = await run('pending', 'oldest', 'Ana Pérez');
    expect(sql).toContain('s.first_name ILIKE');
    expect(sql).toContain("CONCAT_WS(' ', s.first_name, s.last_name)");
    expect(sql).toContain('s.dni ILIKE');
    expect(sql).toContain("COALESCE(s.phone, '') ILIKE");
  });

  it.each([
    ['oldest', 'MIN(fc.due_date)'],
    ['highest-debt', 'SUM(fc.outstanding) DESC'],
    ['name', 's.last_name'],
  ] as const)('orders by %s in the database', async (sort, fragment) => {
    expect((await run('pending', sort)).sql).toContain(fragment);
  });

  it('returns decimal zero and an empty page', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        {
          totalStudents: 0n,
          totalCharges: 0n,
          overdueCharges: 0n,
          partialCharges: 0n,
          totalOriginal: new Prisma.Decimal(0),
          totalPaid: new Prisma.Decimal(0),
          totalOutstanding: new Prisma.Decimal(0),
        },
      ])
      .mockResolvedValueOnce([]);
    const result = await new ReceivablesService({
      $queryRaw: queryRaw,
    } as unknown as PrismaService).list({
      scope: 'pending',
      sort: 'oldest',
      page: 1,
      pageSize: 25,
    });
    expect(result.summary.totalOutstanding).toBe('0.00');
    expect(result.items).toEqual([]);
  });
});
