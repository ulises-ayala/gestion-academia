import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { integrationDatabaseEnabled } from '../../database/integration-database';
import {
  integrationTestTimeoutMs,
  prismaTransactionOptions,
} from '../../database/prisma-transaction-options';
import type { PrismaService } from '../../database/prisma.service';
import { ClosingsService } from './closings.service';
import { ReportsService } from './reports.service';

describe.runIf(integrationDatabaseEnabled)(
  'ClosingsService',
  () => {
    const prisma = new PrismaClient({ transactionOptions: prismaTransactionOptions });
    const service = new ClosingsService(
      prisma as unknown as PrismaService,
      new ReportsService(prisma as unknown as PrismaService),
    );

    beforeAll(() => prisma.$connect());
    afterAll(() => prisma.$disconnect());

    it('separa las formaciones de las cuotas y suma las entregas de efectivo del período', async () => {
      const token = crypto.randomUUID();
      const digits = [...token.replaceAll('-', '')]
        .map((character) => character.charCodeAt(0) % 10)
        .join('');
      const actor = await prisma.adminUser.create({
        data: {
          username: `closing-${token}`,
          passwordHash: 'integration-test-not-a-real-password',
          role: 'MANAGER',
        },
      });
      const teacher = await prisma.teacher.create({
        data: { dni: `7${digits.slice(0, 20)}`, firstName: 'Profe', lastName: `Cierre ${token}` },
      });
      const danceType = await prisma.danceType.create({
        data: { name: `Cierre ${token}`, normalizedName: `closing-${token}` },
      });
      const student = await prisma.student.create({
        data: { dni: `8${digits.slice(0, 20)}`, firstName: 'Cierre', lastName: `Prueba ${token}` },
      });
      const newClass = (name: string, isTraining: boolean) =>
        prisma.academyClass.create({
          data: {
            name: `${name} ${token}`,
            danceTypeId: danceType.id,
            teacherId: teacher.id,
            capacity: 20,
            isTraining,
          },
        });
      const regular = await newClass('Bachata', false);
      const training = await newClass('Formación Docente', true);
      // Un año lejano para no mezclarse con otros datos de la base de tests.
      const startDate = new Date('2032-05-01T00:00:00.000Z');
      const newCharge = async (classId: string, amount: number) => {
        const enrollment = await prisma.enrollment.create({
          data: { studentId: student.id, classId, startDate },
        });
        const charge = await prisma.monthlyCharge.create({
          data: {
            studentId: student.id,
            enrollmentId: enrollment.id,
            period: startDate,
            baseAmount: amount,
            finalAmount: amount,
            dueDate: new Date('2032-05-10T00:00:00.000Z'),
            status: 'PAID',
          },
        });
        return { enrollment, charge };
      };
      const regularCharge = await newCharge(regular.id, 25000);
      const trainingCharge = await newCharge(training.id, 75000);
      const paidAt = new Date('2032-05-04T15:00:00.000Z');
      // Un cobro de cuotas mixto: tres cuartos van a la formación.
      const charges = await prisma.payment.create({
        data: {
          studentId: student.id,
          amount: '100000.00',
          paidAt,
          createdByUserId: actor.id,
          tenders: {
            create: [
              { method: 'CASH', amount: '60000.00' },
              { method: 'MERCADO_PAGO', amount: '40000.00' },
            ],
          },
          allocations: {
            create: [
              { monthlyChargeId: regularCharge.charge.id, amount: '25000.00' },
              { monthlyChargeId: trainingCharge.charge.id, amount: '75000.00' },
            ],
          },
        },
      });
      // Una clase suelta de la formación va entera a Formaciones.
      const single = await prisma.payment.create({
        data: {
          studentId: student.id,
          amount: '10000.00',
          kind: 'OTHER',
          concept: 'SINGLE_CLASS',
          classId: training.id,
          teacherId: teacher.id,
          paidAt,
          createdByUserId: actor.id,
          tenders: { create: [{ method: 'MERCADO_PAGO', amount: '10000.00' }] },
        },
      });
      const handover = await prisma.cashHandover.create({
        data: {
          fromDate: new Date('2032-05-03T00:00:00.000Z'),
          toDate: new Date('2032-05-08T00:00:00.000Z'),
          amount: '50000.00',
          collectedAmount: '60000.00',
          receivedBy: 'Dirección',
          createdByUserId: actor.id,
        },
      });
      try {
        const preview = await service.preview(
          'WEEKLY',
          { fromDate: '2032-05-03', toDate: '2032-05-08' },
          new Date('2032-05-20T15:00:00.000Z'),
        );
        const row = (concept: string) =>
          preview.figures.collections.byConceptAndMethod.find((item) => item.concept === concept);
        const amount = (concept: string, method: string) =>
          row(concept)?.byMethod.find((item) => item.method === method)?.amount;
        expect(row('TRAINING')).toMatchObject({ label: 'Formaciones', total: '85000.00' });
        expect(amount('TRAINING', 'CASH')).toBe('45000.00');
        expect(amount('TRAINING', 'MERCADO_PAGO')).toBe('40000.00');
        expect(row('CHARGES')).toMatchObject({ total: '25000.00' });
        expect(amount('CHARGES', 'CASH')).toBe('15000.00');
        expect(amount('CHARGES', 'MERCADO_PAGO')).toBe('10000.00');
        expect(row('SINGLE_CLASS')).toBeUndefined();
        expect(preview.figures.collections.total).toBe('110000.00');
        expect(preview.sequence).toBe(1);
        expect(preview.handovers).toMatchObject({
          delivered: '50000.00',
          cash: '60000.00',
          difference: '-10000.00',
        });
        expect(preview.handovers.items.map((item) => item.id)).toEqual([handover.id]);
      } finally {
        await prisma.cashHandover.delete({ where: { id: handover.id } });
        const paymentIds = [charges.id, single.id];
        await prisma.paymentAllocation.deleteMany({ where: { paymentId: { in: paymentIds } } });
        await prisma.paymentTender.deleteMany({ where: { paymentId: { in: paymentIds } } });
        await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
        await prisma.monthlyCharge.deleteMany({ where: { studentId: student.id } });
        await prisma.enrollment.deleteMany({ where: { studentId: student.id } });
        await prisma.academyClass.deleteMany({ where: { id: { in: [regular.id, training.id] } } });
        await prisma.danceType.delete({ where: { id: danceType.id } });
        await prisma.student.delete({ where: { id: student.id } });
        await prisma.teacher.delete({ where: { id: teacher.id } });
        await prisma.adminUser.delete({ where: { id: actor.id } });
      }
    });
  },
  integrationTestTimeoutMs,
);
