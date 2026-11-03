import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import type { PrismaService } from '../../database/prisma.service';
import {
  integrationTestTimeoutMs,
  prismaTransactionOptions,
} from '../../database/prisma-transaction-options';
import { integrationDatabaseEnabled } from '../../database/integration-database';
import { SettlementsService } from './settlements.service';

// Un mes que ningún otro test usa, ya terminado (se puede cerrar).
const PERIOD = '2019-02';

describe.runIf(integrationDatabaseEnabled)(
  'Liquidación de profesores',
  () => {
    const prisma = new PrismaClient({ transactionOptions: prismaTransactionOptions });
    const service = new SettlementsService(prisma as unknown as PrismaService);

    const createFixture = async () => {
      const token = crypto.randomUUID();
      const digits = [...token.replaceAll('-', '')]
        .map((character) => character.charCodeAt(0) % 10)
        .join('');
      const teacher = await prisma.teacher.create({
        data: { dni: `7${digits.slice(0, 20)}`, firstName: 'Joselo', lastName: `Prueba ${token}` },
      });
      const user = await prisma.adminUser.create({
        data: {
          username: `settlements-test-${token}`,
          passwordHash: 'integration-test-not-a-real-password',
          role: 'ADMINISTRATOR',
        },
      });
      const danceType = await prisma.danceType.create({
        data: { name: `Zumba ${token}`, normalizedName: `settlements-test-${token}` },
      });
      const academyClass = await prisma.academyClass.create({
        data: {
          name: `Zumba ${token}`,
          danceTypeId: danceType.id,
          teacherId: teacher.id,
          capacity: 20,
        },
      });
      const tariff = await prisma.tariff.create({
        data: {
          classId: academyClass.id,
          name: 'Zumba mensual',
          amount: 40000,
          validFrom: new Date('2019-01-01T00:00:00.000Z'),
        },
      });
      const student = await prisma.student.create({
        data: { dni: `8${digits.slice(0, 20)}`, firstName: 'Ana', lastName: `Prueba ${token}` },
      });
      const enrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id,
          classId: academyClass.id,
          startDate: new Date('2019-02-01T00:00:00.000Z'),
          tariffId: tariff.id,
        },
      });
      const charge = await prisma.monthlyCharge.create({
        data: {
          studentId: student.id,
          enrollmentId: enrollment.id,
          tariffId: tariff.id,
          period: new Date('2019-02-01T00:00:00.000Z'),
          baseAmount: 40000,
          finalAmount: 40000,
          dueDate: new Date('2019-02-10T00:00:00.000Z'),
        },
      });
      const payment = await prisma.payment.create({
        data: {
          studentId: student.id,
          amount: 40000,
          createdByUserId: user.id,
          paidAt: new Date('2019-02-15T15:00:00.000Z'),
          allocations: { create: { monthlyChargeId: charge.id, amount: 40000 } },
        },
      });
      const actor = { id: user.id, username: user.username, role: 'ADMINISTRATOR' };
      return {
        teacher,
        user,
        actor: actor as PublicAuthUser,
        danceType,
        academyClass,
        tariff,
        student,
        enrollment,
        charge,
        payment,
      };
    };
    type Fixture = Awaited<ReturnType<typeof createFixture>>;
    const cleanupFixture = async (fixture: Fixture) => {
      await prisma.auditLog.deleteMany({ where: { actorUserId: fixture.user.id } });
      await prisma.settlementClosing.deleteMany({ where: { closedByUserId: fixture.user.id } });
      await prisma.classSettlementPlan.deleteMany({ where: { classId: fixture.academyClass.id } });
      await prisma.paymentAllocation.deleteMany({ where: { paymentId: fixture.payment.id } });
      await prisma.payment.deleteMany({ where: { id: fixture.payment.id } });
      await prisma.monthlyCharge.deleteMany({ where: { id: fixture.charge.id } });
      await prisma.enrollment.deleteMany({ where: { id: fixture.enrollment.id } });
      await prisma.tariff.deleteMany({ where: { id: fixture.tariff.id } });
      await prisma.student.deleteMany({ where: { id: fixture.student.id } });
      await prisma.academyClass.deleteMany({ where: { id: fixture.academyClass.id } });
      await prisma.danceType.deleteMany({ where: { id: fixture.danceType.id } });
      await prisma.teacher.deleteMany({ where: { id: fixture.teacher.id } });
      await prisma.adminUser.deleteMany({ where: { id: fixture.user.id } });
    };

    beforeAll(() => prisma.$connect());
    afterAll(() => prisma.$disconnect());

    it('liquida con el reparto de la clase, cierra el mes y lo reabre', async () => {
      const fixture = await createFixture();
      try {
        const before = await service.get(PERIOD);
        expect(before.unconfigured).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ classId: fixture.academyClass.id, collected: '40000.00' }),
          ]),
        );

        const plan = await service.savePlan(
          fixture.academyClass.id,
          { validFrom: '2019-01', shares: [{ teacherId: fixture.teacher.id, percentage: '60' }] },
          fixture.actor,
        );
        expect(plan).toMatchObject({ validFrom: '2019-01', academyPercentage: '40.00' });
        // Guardar de nuevo desde el mismo mes reemplaza el reparto.
        await service.savePlan(
          fixture.academyClass.id,
          { validFrom: '2019-01', shares: [{ teacherId: fixture.teacher.id, percentage: '50' }] },
          fixture.actor,
        );
        await expect(service.plans(fixture.academyClass.id)).resolves.toHaveLength(1);

        const open = await service.get(PERIOD);
        const mine = open.teachers.find((item) => item.teacher.id === fixture.teacher.id);
        expect(mine).toMatchObject({ total: '20000.00' });
        expect(open.canClose).toBe(true);

        const closed = await service.close(PERIOD, 'Pagado', fixture.actor);
        expect(closed).toMatchObject({ status: 'CLOSED', note: 'Pagado' });

        // Lo cerrado no cambia aunque después se anule el pago.
        await prisma.payment.update({
          where: { id: fixture.payment.id },
          data: { status: 'VOID', voidedAt: new Date() },
        });
        const frozen = await service.get(PERIOD);
        expect(
          frozen.teachers.find((item) => item.teacher.id === fixture.teacher.id),
        ).toMatchObject({ total: '20000.00' });

        const reopened = await service.reopen(PERIOD, 'Se anuló un pago', fixture.actor);
        expect(reopened.status).toBe('OPEN');
        expect(
          reopened.teachers.find((item) => item.teacher.id === fixture.teacher.id),
        ).toBeUndefined();
        await expect(
          prisma.auditLog.count({
            where: { actorUserId: fixture.user.id, entityType: 'SETTLEMENT' },
          }),
        ).resolves.toBe(2);
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('liquida la clase suelta de un alumno eventual (sin ficha)', async () => {
      const fixture = await createFixture();
      const walkIn = await prisma.payment.create({
        data: {
          walkInName: 'Lucía Eventual',
          amount: 8000,
          kind: 'OTHER',
          concept: 'SINGLE_CLASS',
          classId: fixture.academyClass.id,
          teacherId: fixture.teacher.id,
          createdByUserId: fixture.user.id,
          paidAt: new Date('2019-03-15T15:00:00.000Z'),
        },
      });
      try {
        await service.savePlan(
          fixture.academyClass.id,
          { validFrom: '2019-01', shares: [{ teacherId: fixture.teacher.id, percentage: '50' }] },
          fixture.actor,
        );
        const march = await service.get('2019-03');
        expect(march.teachers.find((item) => item.teacher.id === fixture.teacher.id)).toMatchObject(
          { total: '4000.00' },
        );
      } finally {
        await prisma.payment.delete({ where: { id: walkIn.id } });
        await cleanupFixture(fixture);
      }
    });
  },
  integrationTestTimeoutMs,
);
