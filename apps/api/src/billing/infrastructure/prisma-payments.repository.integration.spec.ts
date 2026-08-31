import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { ReceivablesService } from '../application/receivables.service';
import { PrismaBillingRepository } from './prisma-billing.repository';
import { PrismaPaymentsRepository } from './prisma-payments.repository';

const enabled = Boolean(process.env.DATABASE_URL);
describe.runIf(enabled)('PrismaPaymentsRepository concurrency', () => {
  const prisma = new PrismaClient();
  const repository = new PrismaPaymentsRepository(prisma as PrismaService);
  const billing = new PrismaBillingRepository(prisma as PrismaService);
  const receivables = new ReceivablesService(prisma as PrismaService);

  const createFixture = async () => {
    const token = crypto.randomUUID();
    const numericToken = [...token]
      .map((character) => character.charCodeAt(0) % 10)
      .join('')
      .slice(0, 32);
    return prisma.$transaction(async (tx) => {
      const actor = await tx.adminUser.create({
        data: {
          username: `payments-test-${token}`,
          passwordHash: 'integration-test-not-a-real-password',
          role: 'MANAGER',
          status: 'ACTIVE',
        },
      });
      const student = await tx.student.create({
        data: {
          dni: numericToken,
          firstName: 'Pago',
          lastName: 'Prueba',
          joinedAt: new Date('2026-08-01T00:00:00.000Z'),
        },
      });
      const teacher = await tx.teacher.create({
        data: {
          dni: `9${numericToken.slice(0, 31)}`,
          firstName: 'Docente',
          lastName: 'Prueba',
        },
      });
      const danceType = await tx.danceType.create({
        data: { name: `Danza ${token}`, normalizedName: `payments-test-${token}` },
      });
      const academicClass = await tx.academyClass.create({
        data: {
          name: `Clase pagos ${token}`,
          danceTypeId: danceType.id,
          teacherId: teacher.id,
          capacity: 10,
        },
      });
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: student.id,
          classId: academicClass.id,
          startDate: new Date('2026-08-01T00:00:00.000Z'),
        },
      });
      const tariff = await tx.tariff.create({
        data: {
          name: `Tarifa pagos ${token}`,
          amount: '40000.00',
          validFrom: new Date('2026-08-01T00:00:00.000Z'),
        },
      });
      const charge = await tx.monthlyCharge.create({
        data: {
          studentId: student.id,
          enrollmentId: enrollment.id,
          tariffId: tariff.id,
          period: new Date('2026-08-01T00:00:00.000Z'),
          baseAmount: '40000.00',
          discountAmount: '0.00',
          finalAmount: '40000.00',
          dueDate: new Date('2026-08-10T00:00:00.000Z'),
        },
      });
      const secondCharge = await tx.monthlyCharge.create({
        data: {
          studentId: student.id,
          enrollmentId: enrollment.id,
          tariffId: tariff.id,
          period: new Date('2026-09-01T00:00:00.000Z'),
          baseAmount: '40000.00',
          discountAmount: '0.00',
          finalAmount: '40000.00',
          dueDate: new Date('2026-09-10T00:00:00.000Z'),
        },
      });
      return {
        actor,
        student,
        teacher,
        danceType,
        academicClass,
        enrollment,
        tariff,
        charge,
        secondCharge,
      };
    });
  };

  const cleanupFixture = async (fixture: Awaited<ReturnType<typeof createFixture>>) => {
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { actorUserId: fixture.actor.id } });
      const paymentIds = (
        await tx.payment.findMany({
          where: {
            allocations: {
              some: { monthlyChargeId: { in: [fixture.charge.id, fixture.secondCharge.id] } },
            },
          },
          select: { id: true },
        })
      ).map(({ id }) => id);
      if (paymentIds.length) {
        await tx.paymentTender.deleteMany({ where: { paymentId: { in: paymentIds } } });
        await tx.paymentAllocation.deleteMany({ where: { paymentId: { in: paymentIds } } });
        await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
      }
      await tx.monthlyCharge.deleteMany({
        where: { id: { in: [fixture.charge.id, fixture.secondCharge.id] } },
      });
      await tx.tariff.delete({ where: { id: fixture.tariff.id } });
      await tx.enrollment.delete({ where: { id: fixture.enrollment.id } });
      await tx.academyClass.delete({ where: { id: fixture.academicClass.id } });
      await tx.danceType.delete({ where: { id: fixture.danceType.id } });
      await tx.teacher.delete({ where: { id: fixture.teacher.id } });
      await tx.student.delete({ where: { id: fixture.student.id } });
      await tx.adminUser.delete({ where: { id: fixture.actor.id } });
    });
  };

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  it('confirma una sola vez cuando dos cajas cobran la misma cuota', async () => {
    const fixture = await createFixture();
    try {
      const results = await Promise.allSettled([
        repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '80000.00' }],
          fixture.actor.id,
        ),
        repository.create(
          fixture.student.id,
          [{ method: 'CARD', amount: '80000.00' }],
          fixture.actor.id,
        ),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(results.find((result) => result.status === 'rejected')).toMatchObject({
        reason: { code: 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE' },
      });
      expect(
        await prisma.payment.count({
          where: {
            status: 'CONFIRMED',
            allocations: { some: { monthlyChargeId: fixture.charge.id } },
          },
        }),
      ).toBe(1);
      expect(
        await prisma.monthlyCharge.findUnique({
          where: { id: fixture.charge.id },
          select: { status: true },
        }),
      ).toEqual({ status: 'PAID' });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('recalcula PARTIAL y PENDING al anular pagos sin borrar el historial', async () => {
    const fixture = await createFixture();
    try {
      const first = await repository.create(
        fixture.student.id,
        [{ method: 'CASH', amount: '10000.00' }],
        fixture.actor.id,
      );
      await expect(billing.findCharge(fixture.charge.id)).resolves.toMatchObject({
        status: 'PARTIAL',
        paidAmount: '10000.00',
        outstandingAmount: '30000.00',
        overdue: true,
      });
      await expect(
        receivables.list({ scope: 'pending', sort: 'oldest', page: 1, pageSize: 100 }),
      ).resolves.toMatchObject({
        items: expect.arrayContaining([
          expect.objectContaining({
            student: expect.objectContaining({ id: fixture.student.id }),
            openChargeCount: 2,
            outstandingAmount: '70000.00',
          }),
        ]),
      });
      const second = await repository.create(
        fixture.student.id,
        [{ method: 'MERCADO_PAGO', amount: '30000.00' }],
        fixture.actor.id,
      );
      expect(
        (await prisma.monthlyCharge.findUnique({ where: { id: fixture.charge.id } }))?.status,
      ).toBe('PAID');
      const voided = await repository.void(
        second.id,
        fixture.actor.id,
        'Pago registrado por error',
      );
      expect(voided).toMatchObject({ status: 'VOID', tenders: [{ method: 'MERCADO_PAGO' }] });
      expect(
        (await prisma.monthlyCharge.findUnique({ where: { id: fixture.charge.id } }))?.status,
      ).toBe('PARTIAL');
      await expect(billing.findCharge(fixture.charge.id)).resolves.toMatchObject({
        paidAmount: '10000.00',
        outstandingAmount: '30000.00',
      });
      await repository.void(first.id, fixture.actor.id, 'Segundo ajuste');
      expect(
        await prisma.payment.findUnique({ where: { id: first.id }, select: { status: true } }),
      ).toEqual({ status: 'VOID' });
      expect(
        await prisma.monthlyCharge.findUnique({
          where: { id: fixture.charge.id },
          select: { status: true },
        }),
      ).toEqual({ status: 'PENDING' });
      await expect(billing.findCharge(fixture.charge.id)).resolves.toMatchObject({
        paidAmount: '0.00',
        outstandingAmount: '40000.00',
      });
      expect(
        await prisma.paymentAllocation.count({
          where: { monthlyChargeId: fixture.charge.id },
        }),
      ).toBe(2);
      expect(
        await prisma.paymentTender.count({ where: { paymentId: { in: [first.id, second.id] } } }),
      ).toBe(2);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('imputa oldest-first y derrama el remanente a la siguiente cuota', async () => {
    const fixture = await createFixture();
    try {
      const payment = await repository.create(
        fixture.student.id,
        [
          { method: 'CASH', amount: '30000.00' },
          { method: 'MERCADO_PAGO', amount: '20000.00' },
        ],
        fixture.actor.id,
      );
      expect(payment.amount).toBe('50000.00');
      expect(payment.tenders).toHaveLength(2);
      expect(
        payment.allocations.map(({ monthlyChargeId, amount }) => ({ monthlyChargeId, amount })),
      ).toEqual([
        { monthlyChargeId: fixture.charge.id, amount: '40000.00' },
        { monthlyChargeId: fixture.secondCharge.id, amount: '10000.00' },
      ]);
      expect(
        await prisma.monthlyCharge.findMany({
          where: { id: { in: [fixture.charge.id, fixture.secondCharge.id] } },
          orderBy: { dueDate: 'asc' },
          select: { status: true },
        }),
      ).toEqual([{ status: 'PAID' }, { status: 'PARTIAL' }]);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it('filtra cuentas e historial global sobre saldos y tenders reales', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T15:00:00.000Z'));
    const fixture = await createFixture();
    try {
      const mixed = await repository.create(
        fixture.student.id,
        [
          { method: 'CASH', amount: '6000.00' },
          { method: 'MERCADO_PAGO', amount: '4000.00' },
        ],
        fixture.actor.id,
      );
      await expect(
        receivables.list({
          scope: 'partial',
          q: fixture.student.dni,
          sort: 'oldest',
          page: 1,
          pageSize: 25,
        }),
      ).resolves.toMatchObject({
        summary: {
          totalStudents: 1,
          totalCharges: 1,
          partialCharges: 1,
          totalPaid: '10000.00',
          totalOutstanding: '30000.00',
        },
        items: [
          expect.objectContaining({
            student: expect.objectContaining({ id: fixture.student.id }),
            paidAmount: '10000.00',
            outstandingAmount: '30000.00',
          }),
        ],
      });
      await expect(
        receivables.list({
          scope: 'overdue',
          q: fixture.student.dni,
          sort: 'oldest',
          page: 1,
          pageSize: 25,
        }),
      ).resolves.toMatchObject({
        summary: { totalCharges: 1, overdueCharges: 1, totalOutstanding: '30000.00' },
      });
      await expect(
        receivables.list({
          scope: 'unpaid',
          q: fixture.student.dni,
          sort: 'oldest',
          page: 1,
          pageSize: 25,
        }),
      ).resolves.toMatchObject({
        summary: { totalCharges: 1, totalPaid: '0.00', totalOutstanding: '40000.00' },
      });
      for (const q of ['Pago Prueba', fixture.student.dni]) {
        await expect(
          receivables.list({ scope: 'pending', q, sort: 'highest-debt', page: 1, pageSize: 1 }),
        ).resolves.toMatchObject({ total: 1, items: [{ student: { id: fixture.student.id } }] });
      }
      for (const paymentMethod of ['CASH', 'MERCADO_PAGO'] as const) {
        await expect(
          repository.findPage({
            q: fixture.student.dni,
            paymentMethod,
            page: 1,
            pageSize: 25,
          }),
        ).resolves.toMatchObject({
          items: [expect.objectContaining({ id: mixed.id, tenders: expect.arrayContaining([]) })],
        });
      }
      await expect(
        repository.findPage({
          q: `Pago ${fixture.student.dni}`,
          status: 'CONFIRMED',
          from: new Date('2026-08-31T00:00:00.000Z'),
          toExclusive: new Date('2026-09-01T00:00:00.000Z'),
          page: 1,
          pageSize: 25,
        }),
      ).resolves.toMatchObject({ items: [expect.objectContaining({ id: mixed.id })] });
      await repository.void(mixed.id, fixture.actor.id, 'Validación de filtros');
      await expect(
        repository.findPage({ q: fixture.student.dni, status: 'VOID', page: 1, pageSize: 25 }),
      ).resolves.toMatchObject({ items: [expect.objectContaining({ id: mixed.id })] });
      await expect(
        receivables.list({
          scope: 'pending',
          q: fixture.student.dni,
          sort: 'name',
          page: 1,
          pageSize: 25,
        }),
      ).resolves.toMatchObject({
        summary: { totalCharges: 2, totalPaid: '0.00', totalOutstanding: '80000.00' },
      });
      await prisma.monthlyCharge.update({
        where: { id: fixture.charge.id },
        data: { status: 'VOID' },
      });
      await expect(
        receivables.list({
          scope: 'pending',
          q: fixture.student.dni,
          sort: 'oldest',
          page: 1,
          pageSize: 25,
        }),
      ).resolves.toMatchObject({ summary: { totalCharges: 1, totalOutstanding: '40000.00' } });
    } finally {
      vi.useRealTimers();
      await cleanupFixture(fixture);
    }
  });
});
