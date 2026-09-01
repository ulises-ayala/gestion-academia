import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import { CashShiftsService } from './cash-shifts.service';

const enabled = Boolean(process.env.DATABASE_URL);
describe.runIf(enabled)('CashShiftsService integration', () => {
  const prisma = new PrismaClient();
  const service = new CashShiftsService(prisma as PrismaService);
  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  it('abre una sola caja, cierra con diferencia y corrige sin reescribir el original', async () => {
    const token = crypto.randomUUID();
    const actor = await prisma.adminUser.create({
      data: {
        username: `cash-test-${token}`,
        passwordHash: 'integration-test-not-a-real-password',
        role: 'MANAGER',
      },
    });
    try {
      const opened = await service.open(actor.id);
      expect(opened).toMatchObject({ status: 'OPEN', expectedByMethod: { CASH: '0.00' } });
      await expect(service.open(actor.id)).rejects.toMatchObject({
        code: 'CASH_SHIFT_ALREADY_OPEN',
      });

      const closed = await service.close(
        opened.id,
        { declaredByMethod: { CASH: '98.00', MERCADO_PAGO: '50.00', CARD: '0.00' } },
        actor.id,
      );
      expect(closed.status).toBe('CLOSED');
      expect(closed.closingLines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: 'CASH',
            expectedAmount: '0.00',
            declaredAmount: '98.00',
            differenceAmount: '98.00',
          }),
        ]),
      );
      await expect(
        service.close(
          opened.id,
          { declaredByMethod: { CASH: '0', MERCADO_PAGO: '0', CARD: '0' } },
          actor.id,
        ),
      ).rejects.toMatchObject({ code: 'CASH_SHIFT_ALREADY_CLOSED' });

      const corrected = await service.correct(
        opened.id,
        { method: 'CASH', correctedDeclaredAmount: '100.00', reason: 'Conteo verificado' },
        actor.id,
      );
      expect(corrected.closingLines.find(({ method }) => method === 'CASH')).toMatchObject({
        declaredAmount: '98.00',
      });
      expect(corrected.correctedByMethod.find(({ method }) => method === 'CASH')).toMatchObject({
        declaredAmount: '100.00',
      });
      expect(corrected.corrections).toHaveLength(1);
      await expect(
        service.correct(
          opened.id,
          { method: 'CASH', correctedDeclaredAmount: '100.00', reason: '' },
          actor.id,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

      const consolidated = await service.consolidated(
        new Date(Date.now() - 60_000),
        new Date(Date.now() + 60_000),
      );
      expect(consolidated.shiftCount).toBeGreaterThanOrEqual(1);
    } finally {
      const shifts = await prisma.cashShift.findMany({
        where: { userId: actor.id },
        select: { id: true },
      });
      const ids = shifts.map(({ id }) => id);
      await prisma.auditLog.deleteMany({ where: { actorUserId: actor.id } });
      await prisma.cashReconciliationCorrection.deleteMany({ where: { cashShiftId: { in: ids } } });
      await prisma.cashShiftClosingLine.deleteMany({ where: { cashShiftId: { in: ids } } });
      await prisma.cashShift.deleteMany({ where: { id: { in: ids } } });
      await prisma.adminUser.delete({ where: { id: actor.id } });
    }
  });
});
