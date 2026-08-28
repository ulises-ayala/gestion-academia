import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { PrismaPaymentsRepository } from './prisma-payments.repository';

const enabled = Boolean(process.env.DATABASE_URL);
describe.runIf(enabled)('PrismaPaymentsRepository concurrency', () => {
  const prisma = new PrismaClient();
  const repository = new PrismaPaymentsRepository(prisma as PrismaService);

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  it('confirma una sola vez cuando dos cajas cobran la misma cuota', async () => {
    const charge = await prisma.monthlyCharge.findFirst({
      where: { status: 'PENDING' },
      orderBy: { id: 'asc' },
    });
    const actor = await prisma.adminUser.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { id: 'asc' },
    });
    expect(charge).not.toBeNull();
    expect(actor).not.toBeNull();
    const beforeIds = (
      await prisma.paymentAllocation.findMany({
        where: { monthlyChargeId: charge!.id },
        select: { paymentId: true },
      })
    ).map((item) => item.paymentId);
    try {
      const results = await Promise.allSettled([
        repository.create([charge!.id], 'CASH', actor!.id),
        repository.create([charge!.id], 'CARD', actor!.id),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(results.find((result) => result.status === 'rejected')).toMatchObject({
        reason: { code: 'PAYMENT_CHARGE_NOT_PENDING' },
      });
      expect(
        await prisma.payment.count({
          where: { status: 'CONFIRMED', allocations: { some: { monthlyChargeId: charge!.id } } },
        }),
      ).toBe(1);
      expect(
        await prisma.monthlyCharge.findUnique({
          where: { id: charge!.id },
          select: { status: true },
        }),
      ).toEqual({ status: 'PAID' });
    } finally {
      const created = await prisma.payment.findMany({
        where: { allocations: { some: { monthlyChargeId: charge!.id } }, id: { notIn: beforeIds } },
        select: { id: true },
      });
      const createdIds = created.map((item) => item.id);
      if (createdIds.length) {
        await prisma.paymentAllocation.deleteMany({ where: { paymentId: { in: createdIds } } });
        await prisma.payment.deleteMany({ where: { id: { in: createdIds } } });
      }
      await prisma.monthlyCharge.update({ where: { id: charge!.id }, data: { status: 'PENDING' } });
    }
  });

  it('permite pagar, anular y volver a pagar conservando ambos historiales', async () => {
    const charge = await prisma.monthlyCharge.findFirst({
      where: { status: 'PENDING' },
      orderBy: { id: 'desc' },
    });
    const actors = await prisma.adminUser.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { id: 'asc' },
      take: 2,
    });
    expect(charge).not.toBeNull();
    expect(actors.length).toBeGreaterThan(0);
    const createdIds: string[] = [];
    try {
      const first = await repository.create([charge!.id], 'CASH', actors[0]!.id);
      createdIds.push(first.id);
      const voided = await repository.void(first.id, actors.at(1)?.id ?? actors[0]!.id);
      const second = await repository.create([charge!.id], 'CARD', actors[0]!.id);
      createdIds.push(second.id);
      expect(voided).toMatchObject({
        status: 'VOID',
        allocations: [{ monthlyChargeId: charge!.id }],
      });
      expect(second).toMatchObject({
        status: 'CONFIRMED',
        allocations: [{ monthlyChargeId: charge!.id }],
      });
      expect(
        await prisma.payment.findUnique({ where: { id: first.id }, select: { status: true } }),
      ).toEqual({ status: 'VOID' });
      expect(
        await prisma.monthlyCharge.findUnique({
          where: { id: charge!.id },
          select: { status: true },
        }),
      ).toEqual({ status: 'PAID' });
    } finally {
      if (createdIds.length) {
        await prisma.paymentAllocation.deleteMany({ where: { paymentId: { in: createdIds } } });
        await prisma.payment.deleteMany({ where: { id: { in: createdIds } } });
      }
      await prisma.monthlyCharge.update({ where: { id: charge!.id }, data: { status: 'PENDING' } });
    }
  });
});
