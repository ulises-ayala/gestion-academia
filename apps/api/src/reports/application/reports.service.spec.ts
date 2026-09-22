import { Prisma } from '@academy/database';
import { describe, expect, it, vi } from 'vitest';
import { ReportsService } from './reports.service';

const decimal = (value: string | number) => new Prisma.Decimal(value);

describe('ReportsService', () => {
  it('usa sólo cobros confirmados, separa un pago mixto y conserva la deuda calculada', async () => {
    const queryRows = [
      [{ pendingDebt: decimal('15.00'), overdueCharges: 1n, overdueDebt: decimal('15.00') }],
      [
        {
          id: 'student-1',
          firstName: 'Ana',
          lastName: 'Pérez',
          dni: '1',
          status: 'ACTIVE',
          joinedAt: new Date('2026-09-01'),
          activeEnrollments: 1n,
          currentDebt: decimal('15.00'),
          total: 1n,
        },
      ],
      [
        {
          studentId: 'student-1',
          firstName: 'Ana',
          lastName: 'Pérez',
          dni: '1',
          openCharges: 1n,
          overdueCharges: 1n,
          totalDebt: decimal('15.00'),
          overdueDebt: decimal('15.00'),
          oldestDueDate: new Date('2026-08-10'),
          total: 1n,
        },
      ],
      [{ date: new Date('2026-09-10'), amount: decimal('50000.00') }],
      [
        {
          classId: 'class-1',
          className: 'Tango',
          teacherName: 'Ada Docente',
          records: 3n,
          present: 1n,
          absent: 1n,
          justified: 1n,
        },
      ],
    ];
    const paymentAggregate = vi.fn().mockResolvedValue({
      _count: { id: 1 },
      _sum: { amount: decimal('50000.00') },
    });
    const prisma = {
      student: {
        groupBy: vi.fn().mockResolvedValue([{ status: 'ACTIVE', _count: { id: 1 } }]),
        count: vi.fn().mockResolvedValue(1),
      },
      payment: { aggregate: paymentAggregate, findMany: vi.fn().mockResolvedValue([]) },
      paymentTender: {
        groupBy: vi.fn().mockResolvedValue([
          { method: 'CASH', _sum: { amount: decimal('30000.00') } },
          { method: 'MERCADO_PAGO', _sum: { amount: decimal('20000.00') } },
        ]),
      },
      cashShift: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      $queryRaw: vi.fn().mockImplementation(() => Promise.resolve(queryRows.shift())),
    };
    const service = new ReportsService(prisma as never);
    const report = await service.operational({
      from: new Date('2026-09-01T03:00:00Z'),
      toExclusive: new Date('2026-10-01T03:00:00Z'),
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      page: 1,
      pageSize: 20,
      debtSort: 'highest',
    });
    expect(paymentAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'CONFIRMED' }) }),
    );
    expect(report.collections.total).toBe('50000.00');
    expect(report.collections.byMethod).toEqual([
      { method: 'CASH', amount: '30000.00' },
      { method: 'MERCADO_PAGO', amount: '20000.00' },
      { method: 'CARD', amount: '0.00' },
    ]);
    expect(report.summary.pendingDebt).toBe('15.00');
    expect(report.debtors.items[0]).toMatchObject({ totalDebt: '15.00', overdueDebt: '15.00' });
    expect(report.attendance).toMatchObject({ records: 3, present: 1, absent: 1, justified: 1 });
  });

  it('conserva el cierre original y aplica correcciones de caja al estado actual', () => {
    const service = new ReportsService({} as never);
    const cash = (
      service as unknown as {
        cashReport: (shifts: readonly unknown[]) => {
          byMethod: readonly { method: string; difference: string; correctedDifference: string }[];
          differences: readonly { difference: string; correctedDifference: string }[];
        };
      }
    ).cashReport([
      {
        id: 'shift-1',
        userId: 'user-1',
        user: { username: 'caja' },
        closedAt: new Date('2026-09-10T20:00:00Z'),
        closingLines: [
          { method: 'CASH', expectedAmount: decimal('100000'), declaredAmount: decimal('98000') },
          { method: 'MERCADO_PAGO', expectedAmount: decimal('0'), declaredAmount: decimal('0') },
          { method: 'CARD', expectedAmount: decimal('0'), declaredAmount: decimal('0') },
        ],
        corrections: [{ method: 'CASH', amountDelta: decimal('1000') }],
        movements: [{ method: 'CASH', type: 'COLLECTION', amount: decimal('100000') }],
      },
    ]);
    expect(cash.byMethod.find((item) => item.method === 'CASH')).toMatchObject({
      difference: '-2000.00',
      correctedDifference: '-1000.00',
    });
    expect(cash.differences[0]).toMatchObject({
      difference: '-2000.00',
      correctedDifference: '-1000.00',
    });
  });

  it('exporta todo el resultado filtrado y no sólo la página visible', async () => {
    const service = new ReportsService({} as never);
    const operational = vi.spyOn(service, 'operational').mockResolvedValue({
      students: {
        items: [
          {
            id: 'student-1',
            firstName: 'Ana',
            lastName: 'Pérez',
            dni: '1',
            status: 'ACTIVE',
            joinedAt: '2026-09-01',
            activeEnrollments: 1,
            currentDebt: '15.00',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 100000,
      },
    } as never);
    const input = {
      from: new Date('2026-09-01T03:00:00Z'),
      toExclusive: new Date('2026-10-01T03:00:00Z'),
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      page: 4,
      pageSize: 20,
      debtSort: 'highest' as const,
    };
    const csv = await service.export('students', input);
    expect(operational).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 100000 }),
    );
    expect(csv).toContain('Ana,Pérez,1,Activo,2026-09-01,1,15.00');
  });
});
