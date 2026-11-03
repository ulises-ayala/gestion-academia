import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { integrationDatabaseEnabled } from '../../database/integration-database';
import {
  integrationTestTimeoutMs,
  prismaTransactionOptions,
} from '../../database/prisma-transaction-options';
import type { PrismaService } from '../../database/prisma.service';
import { CashHandoversService } from './cash-handovers.service';

describe.runIf(integrationDatabaseEnabled)(
  'CashHandoversService',
  () => {
    const prisma = new PrismaClient({ transactionOptions: prismaTransactionOptions });
    const service = new CashHandoversService(prisma as unknown as PrismaService);

    beforeAll(() => prisma.$connect());
    afterAll(() => prisma.$disconnect());

    it('registra la entrega con el efectivo del período, no superpone y se anula', async () => {
      const token = crypto.randomUUID();
      const actor = await prisma.adminUser.create({
        data: {
          username: `handover-${token}`,
          passwordHash: 'integration-test-not-a-real-password',
          role: 'MANAGER',
        },
      });
      const student = await prisma.student.create({
        data: {
          dni: [...token]
            .map((c) => c.charCodeAt(0) % 10)
            .join('')
            .slice(0, 30),
          firstName: 'Entrega',
          lastName: 'Prueba',
          joinedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      });
      // Un año lejano para no mezclarse con otros datos de la base de tests.
      const payment = await prisma.payment.create({
        data: {
          studentId: student.id,
          amount: '50000.00',
          kind: 'OTHER',
          concept: 'CARD_SURCHARGE',
          paidAt: new Date('2031-03-03T15:00:00.000Z'),
          createdByUserId: actor.id,
          tenders: {
            create: [
              { method: 'CASH', amount: '30000.00' },
              { method: 'TRANSFER', amount: '20000.00' },
            ],
          },
        },
      });
      // El efectivo entra a la caja cuando se carga en un turno (movimiento), no por fecha de pago.
      const shift = await prisma.cashShift.create({
        data: { userId: actor.id },
      });
      const cashTender = (
        await prisma.paymentTender.findMany({ where: { paymentId: payment.id, method: 'CASH' } })
      )[0]!;
      await prisma.cashMovement.create({
        data: {
          cashShiftId: shift.id,
          type: 'COLLECTION',
          method: 'CASH',
          amount: '30000.00',
          sourcePaymentId: payment.id,
          sourcePaymentTenderId: cashTender.id,
          actorUserId: actor.id,
          createdAt: new Date('2031-03-03T15:00:00.000Z'),
        },
      });
      const now = new Date('2031-03-10T15:00:00.000Z');
      try {
        await expect(service.cashCollected('2031-03-02', '2031-03-08', now)).resolves.toMatchObject(
          { collected: '30000.00' },
        );
        const handover = await service.create(
          { fromDate: '2031-03-02', toDate: '2031-03-08', amount: '29000' },
          actor.id,
          now,
        );
        expect(handover).toMatchObject({
          amount: '29000.00',
          collectedAmount: '30000.00',
          difference: '-1000.00',
          receivedBy: 'Dirección',
        });
        await expect(
          service.create(
            { fromDate: '2031-03-08', toDate: '2031-03-09', amount: '1' },
            actor.id,
            now,
          ),
        ).rejects.toMatchObject({ code: 'CASH_HANDOVER_OVERLAP_CONFLICT' });
        await expect(service.void(handover.id, 'Faltaba un pago', actor.id)).resolves.toMatchObject(
          { voidReason: 'Faltaba un pago' },
        );
        await expect(service.void(handover.id, 'otra vez', actor.id)).rejects.toMatchObject({
          code: 'CASH_HANDOVER_VOID_CONFLICT',
        });
        // Anulada, el período queda libre para registrarla bien.
        await expect(
          service.create(
            { fromDate: '2031-03-02', toDate: '2031-03-08', amount: '30000' },
            actor.id,
            now,
          ),
        ).resolves.toMatchObject({ difference: '0.00' });
      } finally {
        await prisma.auditLog.deleteMany({ where: { actorUserId: actor.id } });
        await prisma.cashHandover.deleteMany({ where: { createdByUserId: actor.id } });
        await prisma.cashMovement.deleteMany({ where: { cashShiftId: shift.id } });
        await prisma.cashShift.delete({ where: { id: shift.id } });
        await prisma.paymentTender.deleteMany({ where: { paymentId: payment.id } });
        await prisma.payment.delete({ where: { id: payment.id } });
        await prisma.student.delete({ where: { id: student.id } });
        await prisma.adminUser.delete({ where: { id: actor.id } });
      }
    });
  },
  integrationTestTimeoutMs,
);
