import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { PrismaPaymentsRepository } from './prisma-payments.repository';

const enabled = Boolean(process.env.DATABASE_URL);
describe.runIf(enabled)('PrismaPaymentsRepository concurrency', () => {
  const prisma = new PrismaClient();
  const repository = new PrismaPaymentsRepository(prisma as PrismaService);

  const createFixture = async () => {
    const token = crypto.randomUUID();
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
          dni: token.replaceAll('-', '').slice(0, 32),
          firstName: 'Pago',
          lastName: 'Prueba',
          joinedAt: new Date('2026-08-01T00:00:00.000Z'),
        },
      });
      const teacher = await tx.teacher.create({
        data: {
          dni: `9${token.replaceAll('-', '').slice(0, 31)}`,
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
      return { actor, student, teacher, danceType, academicClass, enrollment, tariff, charge };
    });
  };

  const cleanupFixture = async (fixture: Awaited<ReturnType<typeof createFixture>>) => {
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { actorUserId: fixture.actor.id } });
      const paymentIds = (
        await tx.payment.findMany({
          where: { allocations: { some: { monthlyChargeId: fixture.charge.id } } },
          select: { id: true },
        })
      ).map(({ id }) => id);
      if (paymentIds.length) {
        await tx.paymentAllocation.deleteMany({ where: { paymentId: { in: paymentIds } } });
        await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
      }
      await tx.monthlyCharge.delete({ where: { id: fixture.charge.id } });
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
        repository.create([fixture.charge.id], 'CASH', fixture.actor.id),
        repository.create([fixture.charge.id], 'CARD', fixture.actor.id),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(results.find((result) => result.status === 'rejected')).toMatchObject({
        reason: { code: 'PAYMENT_CHARGE_NOT_PENDING' },
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

  it('permite pagar, anular y volver a pagar conservando ambos historiales', async () => {
    const fixture = await createFixture();
    try {
      const first = await repository.create([fixture.charge.id], 'CASH', fixture.actor.id);
      const voided = await repository.void(first.id, fixture.actor.id, 'Pago registrado por error');
      const second = await repository.create([fixture.charge.id], 'CARD', fixture.actor.id);
      expect(voided).toMatchObject({
        status: 'VOID',
        allocations: [{ monthlyChargeId: fixture.charge.id }],
      });
      expect(second).toMatchObject({
        status: 'CONFIRMED',
        allocations: [{ monthlyChargeId: fixture.charge.id }],
      });
      expect(
        await prisma.payment.findUnique({ where: { id: first.id }, select: { status: true } }),
      ).toEqual({ status: 'VOID' });
      expect(
        await prisma.monthlyCharge.findUnique({
          where: { id: fixture.charge.id },
          select: { status: true },
        }),
      ).toEqual({ status: 'PAID' });
      expect(
        await prisma.paymentAllocation.count({
          where: { monthlyChargeId: fixture.charge.id },
        }),
      ).toBe(2);
    } finally {
      await cleanupFixture(fixture);
    }
  });
});
