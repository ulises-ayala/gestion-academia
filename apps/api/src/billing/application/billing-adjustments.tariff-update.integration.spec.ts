import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import {
  integrationTestTimeoutMs,
  prismaTransactionOptions,
} from '../../database/prisma-transaction-options';
import { integrationDatabaseEnabled } from '../../database/integration-database';
import { BillingAdjustmentsService } from './billing-adjustments.service';

const NOW = new Date('2026-11-05T15:00:00.000Z');

describe.runIf(integrationDatabaseEnabled)(
  'Actualizar una cuota a la modalidad de la inscripción',
  () => {
    const prisma = new PrismaClient({ transactionOptions: prismaTransactionOptions });
    const service = new BillingAdjustmentsService(prisma as unknown as PrismaService);

    // Caso real: la clase tiene "Completa" ($40.000) y "Reducida" ($25.000); la cuota de noviembre
    // se generó con la completa y después se le asignó la reducida a la alumna.
    const createFixture = async () => {
      const token = crypto.randomUUID();
      const digits = [...token.replaceAll('-', '')]
        .map((character) => character.charCodeAt(0) % 10)
        .join('');
      const teacher = await prisma.teacher.create({
        data: { dni: `7${digits.slice(0, 20)}`, firstName: 'Profe', lastName: `Prueba ${token}` },
      });
      const user = await prisma.adminUser.create({
        data: {
          username: `tariff-update-${token}`,
          passwordHash: 'integration-test-not-a-real-password',
          role: 'MANAGER',
        },
      });
      const danceType = await prisma.danceType.create({
        data: { name: `Cardio ${token}`, normalizedName: `tariff-update-${token}` },
      });
      const academyClass = await prisma.academyClass.create({
        data: {
          name: `Cardiolatin ${token}`,
          danceTypeId: danceType.id,
          teacherId: teacher.id,
          capacity: 20,
        },
      });
      const validFrom = new Date('2026-10-01T00:00:00.000Z');
      const full = await prisma.tariff.create({
        data: { classId: academyClass.id, name: 'Completa', amount: 40000, validFrom },
      });
      const reduced = await prisma.tariff.create({
        data: { classId: academyClass.id, name: 'Reducida', amount: 25000, validFrom },
      });
      const student = await prisma.student.create({
        data: { dni: `8${digits.slice(0, 20)}`, firstName: 'Laura', lastName: `Prueba ${token}` },
      });
      const enrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id,
          classId: academyClass.id,
          startDate: validFrom,
          tariffId: reduced.id,
        },
      });
      const charge = await prisma.monthlyCharge.create({
        data: {
          studentId: student.id,
          enrollmentId: enrollment.id,
          tariffId: full.id,
          period: new Date('2026-11-01T00:00:00.000Z'),
          baseAmount: 40000,
          finalAmount: 40000,
          dueDate: new Date('2026-11-10T00:00:00.000Z'),
        },
      });
      return { teacher, user, danceType, academyClass, full, reduced, student, enrollment, charge };
    };
    type Fixture = Awaited<ReturnType<typeof createFixture>>;
    const cleanup = async (fixture: Fixture) => {
      const payments = await prisma.payment.findMany({
        where: { studentId: fixture.student.id },
        select: { id: true },
      });
      const paymentIds = payments.map(({ id }) => id);
      await prisma.auditLog.deleteMany({ where: { actorUserId: fixture.user.id } });
      await prisma.monthlyChargeAdjustment.deleteMany({
        where: { monthlyChargeId: fixture.charge.id, reversalOfId: { not: null } },
      });
      await prisma.monthlyChargeAdjustment.deleteMany({
        where: { monthlyChargeId: fixture.charge.id },
      });
      await prisma.paymentAllocation.deleteMany({ where: { paymentId: { in: paymentIds } } });
      await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
      await prisma.monthlyCharge.deleteMany({ where: { id: fixture.charge.id } });
      await prisma.enrollment.deleteMany({ where: { id: fixture.enrollment.id } });
      await prisma.tariff.deleteMany({ where: { classId: fixture.academyClass.id } });
      await prisma.student.deleteMany({ where: { id: fixture.student.id } });
      await prisma.academyClass.deleteMany({ where: { id: fixture.academyClass.id } });
      await prisma.danceType.deleteMany({ where: { id: fixture.danceType.id } });
      await prisma.teacher.deleteMany({ where: { id: fixture.teacher.id } });
      await prisma.adminUser.deleteMany({ where: { id: fixture.user.id } });
    };

    beforeAll(() => prisma.$connect());
    afterAll(() => prisma.$disconnect());

    it('muestra el cambio, actualiza la cuota a la modalidad y lo audita', async () => {
      const fixture = await createFixture();
      try {
        const expected = {
          chargeId: fixture.charge.id,
          current: { tariffName: 'Completa', amount: '40000.00' },
          next: { tariffId: fixture.reduced.id, tariffName: 'Reducida', amount: '25000.00' },
        };
        await expect(service.previewTariffUpdate(fixture.charge.id, NOW)).resolves.toEqual(
          expected,
        );
        await expect(
          service.updateTariff(fixture.charge.id, '', fixture.user.id, NOW),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
        await expect(
          service.updateTariff(
            fixture.charge.id,
            ' Paga la modalidad reducida ',
            fixture.user.id,
            NOW,
          ),
        ).resolves.toEqual(expected);
        const charge = await prisma.monthlyCharge.findUniqueOrThrow({
          where: { id: fixture.charge.id },
        });
        expect(charge.tariffId).toBe(fixture.reduced.id);
        expect(charge.baseAmount.toFixed(2)).toBe('25000.00');
        expect(charge.finalAmount.toFixed(2)).toBe('25000.00');
        expect(charge.status).toBe('PENDING');
        const audit = await prisma.auditLog.findFirstOrThrow({
          where: { entityId: fixture.charge.id, action: 'UPDATE' },
        });
        expect(audit).toMatchObject({
          entityType: 'MONTHLY_CHARGE',
          reason: 'Paga la modalidad reducida',
          before: { tariffId: fixture.full.id, baseAmount: '40000.00' },
          after: { tariffId: fixture.reduced.id, baseAmount: '25000.00' },
          metadata: { studentId: fixture.student.id, source: 'TARIFF_UPDATE' },
        });
        // Ya actualizada: no hay nada que cambiar.
        await expect(
          service.updateTariff(fixture.charge.id, 'Otra vez', fixture.user.id, NOW),
        ).rejects.toMatchObject({ code: 'CHARGE_TARIFF_UNCHANGED' });
      } finally {
        await cleanup(fixture);
      }
    });

    it('no toca una cuota con pagos ni con becas', async () => {
      const fixture = await createFixture();
      try {
        const payment = await prisma.payment.create({
          data: {
            studentId: fixture.student.id,
            amount: 10000,
            createdByUserId: fixture.user.id,
            paidAt: NOW,
            allocations: { create: { monthlyChargeId: fixture.charge.id, amount: 10000 } },
          },
        });
        await expect(
          service.updateTariff(fixture.charge.id, 'Con pago', fixture.user.id, NOW),
        ).rejects.toMatchObject({ code: 'CHARGE_TARIFF_NOT_EDITABLE' });
        // Con el pago anulado ya no hay nada imputado, pero una beca vigente también lo impide.
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'VOID' } });
        await prisma.monthlyChargeAdjustment.create({
          data: {
            monthlyChargeId: fixture.charge.id,
            type: 'DIRECTION_SCHOLARSHIP',
            calculation: 'PERCENTAGE',
            configuredValue: 50,
            effectiveAmount: 20000,
            studentAmountDelta: -20000,
            settlementBaseDelta: 0,
            authorizedByUserId: fixture.user.id,
            createdByUserId: fixture.user.id,
            reason: 'Beca',
          },
        });
        await expect(
          service.updateTariff(fixture.charge.id, 'Con beca', fixture.user.id, NOW),
        ).rejects.toMatchObject({ code: 'CHARGE_TARIFF_NOT_EDITABLE' });
        const charge = await prisma.monthlyCharge.findUniqueOrThrow({
          where: { id: fixture.charge.id },
        });
        expect(charge.baseAmount.toFixed(2)).toBe('40000.00');
      } finally {
        await cleanup(fixture);
      }
    });
  },
  integrationTestTimeoutMs,
);
