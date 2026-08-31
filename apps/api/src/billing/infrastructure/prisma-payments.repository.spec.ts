import type { Prisma } from '@academy/database';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import { PrismaPaymentsRepository } from './prisma-payments.repository';

const setup = () => {
  const findMany = vi.fn().mockResolvedValue([]);
  const count = vi.fn().mockResolvedValue(0);
  const prisma = {
    payment: { findMany, count },
    $transaction: (operations: readonly Promise<unknown>[]) => Promise.all(operations),
  } as unknown as PrismaService;
  return { repository: new PrismaPaymentsRepository(prisma), findMany, count };
};

describe('PrismaPaymentsRepository global history', () => {
  it('paginates all payments in reverse chronological order', async () => {
    const { repository, findMany, count } = setup();
    await expect(repository.findPage({ page: 2, pageSize: 25 })).resolves.toEqual({
      items: [],
      total: 0,
      page: 2,
      pageSize: 25,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
        orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(count).toHaveBeenCalledOnce();
  });

  it.each(['CASH', 'MERCADO_PAGO', 'CARD'] as const)(
    'filters %s with PaymentTender.some so mixed payments remain visible',
    async (paymentMethod) => {
      const { repository, findMany } = setup();
      await repository.findPage({ paymentMethod, page: 1, pageSize: 25 });
      expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
        tenders: { some: { method: paymentMethod } },
      });
    },
  );

  it.each(['CONFIRMED', 'VOID'] as const)('filters the %s status', async (status) => {
    const { repository, findMany } = setup();
    await repository.findPage({ status, page: 1, pageSize: 25 });
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({ status });
  });

  it('searches every name/DNI term and accepts a date range', async () => {
    const { repository, findMany } = setup();
    const from = new Date('2026-08-01T03:00:00.000Z');
    const toExclusive = new Date('2026-09-01T03:00:00.000Z');
    await repository.findPage({ q: 'Ana Pérez', from, toExclusive, page: 1, pageSize: 25 });
    const where = findMany.mock.calls[0]?.[0].where as Prisma.PaymentWhereInput;
    expect(where.AND).toHaveLength(2);
    expect(where.paidAt).toEqual({ gte: from, lt: toExclusive });
  });
});
