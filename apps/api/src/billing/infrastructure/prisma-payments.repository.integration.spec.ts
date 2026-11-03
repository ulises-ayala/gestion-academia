import { Prisma, PrismaClient } from '@academy/database';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import {
  integrationTestTimeoutMs,
  prismaTransactionOptions,
} from '../../database/prisma-transaction-options';
import { integrationDatabaseEnabled } from '../../database/integration-database';
import { PrismaEnrollmentRepository } from '../../enrollments/infrastructure/prisma-enrollment.repository';
import { ChargeGenerationService } from '../application/charge-generation.service';
import { PrismaChargeGenerationRepository } from './prisma-charge-generation.repository';
import { BillingAdjustmentsService } from '../application/billing-adjustments.service';
import { ReceivablesService } from '../application/receivables.service';
import { PrismaBillingRepository } from './prisma-billing.repository';
import { PrismaPaymentsRepository } from './prisma-payments.repository';

const enabled = integrationDatabaseEnabled;
describe.runIf(enabled)(
  'PrismaPaymentsRepository concurrency',
  () => {
    const prisma = new PrismaClient({ transactionOptions: prismaTransactionOptions });
    const repository = new PrismaPaymentsRepository(prisma as PrismaService);
    const billing = new PrismaBillingRepository(prisma as PrismaService);
    const receivables = new ReceivablesService(prisma as PrismaService);
    const adjustments = new BillingAdjustmentsService(prisma as PrismaService);
    const enrollments = new PrismaEnrollmentRepository(prisma as PrismaService);
    const generation = new ChargeGenerationService(
      new PrismaChargeGenerationRepository(prisma as PrismaService, billing),
    );

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
        const cashShift = await tx.cashShift.create({ data: { userId: actor.id } });
        const student = await tx.student.create({
          data: {
            dni: numericToken,
            firstName: `Pago-${token}`,
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
            classId: academicClass.id,
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
            // Generadas a tiempo: si nacieran vencidas no llevarían recargo (decisión 202).
            createdAt: new Date('2026-08-01T15:00:00.000Z'),
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
            createdAt: new Date('2026-09-01T15:00:00.000Z'),
          },
        });
        return {
          actor,
          cashShift,
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
              OR: [
                {
                  allocations: { some: { monthlyCharge: { enrollmentId: fixture.enrollment.id } } },
                },
                // Otros cobros del alumno (p. ej. el recargo por tarjeta) no tienen imputaciones.
                { studentId: fixture.student.id },
                // Clases sueltas de alumnos eventuales (sin alumno).
                { classId: fixture.academicClass.id },
              ],
            },
            select: { id: true },
          })
        ).map(({ id }) => id);
        if (paymentIds.length) {
          await tx.cashMovement.deleteMany({ where: { sourcePaymentId: { in: paymentIds } } });
          await tx.paymentTender.deleteMany({ where: { paymentId: { in: paymentIds } } });
          await tx.paymentAllocation.deleteMany({ where: { paymentId: { in: paymentIds } } });
          await tx.paymentReallocation.deleteMany({ where: { paymentId: { in: paymentIds } } });
          // Primero los recargos ligados a un cobro y los reemplazos de una corrección: apuntan a
          // otro pago.
          await tx.payment.deleteMany({
            where: { id: { in: paymentIds }, surchargeOfId: { not: null } },
          });
          await tx.payment.deleteMany({
            where: { id: { in: paymentIds }, correctionOfId: { not: null } },
          });
          await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
        }
        await tx.monthlyChargeAdjustment.deleteMany({
          where: { monthlyCharge: { enrollmentId: fixture.enrollment.id } },
        });
        await tx.monthlyCharge.deleteMany({ where: { enrollmentId: fixture.enrollment.id } });
        await tx.enrollment.update({
          where: { id: fixture.enrollment.id },
          data: { tariffId: null },
        });
        await tx.tariff.deleteMany({ where: { classId: fixture.academicClass.id } });
        await tx.enrollment.delete({ where: { id: fixture.enrollment.id } });
        await tx.academyClass.delete({ where: { id: fixture.academicClass.id } });
        await tx.danceType.delete({ where: { id: fixture.danceType.id } });
        await tx.teacher.delete({ where: { id: fixture.teacher.id } });
        await tx.student.delete({ where: { id: fixture.student.id } });
        await tx.cashShiftClosingLine.deleteMany({ where: { cashShiftId: fixture.cashShift.id } });
        await tx.cashReconciliationCorrection.deleteMany({
          where: { cashShiftId: fixture.cashShift.id },
        });
        await tx.cashShift.deleteMany({ where: { id: fixture.cashShift.id } });
        await tx.adminUser.delete({ where: { id: fixture.actor.id } });
      });
    };

    beforeAll(() => prisma.$connect());
    afterAll(() => prisma.$disconnect());
    beforeEach(() => {
      // Agosto vencido y septiembre aún vigente, sin depender del día de ejecución.
      // Sólo se simula Date: los timers de Prisma y los reintentos siguen funcionando.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-08-31T15:00:00.000Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('cobra y corrige la clase suelta de un alumno eventual sin ficha de alumno', async () => {
      const fixture = await createFixture();
      try {
        const walkIn = { name: `Eventual ${fixture.student.firstName}`, phone: null, dni: null };
        const payment = await repository.createOther(
          {
            studentId: null,
            walkIn,
            concept: 'SINGLE_CLASS',
            classId: fixture.academicClass.id,
            teacherId: fixture.teacher.id,
            detail: null,
          },
          [{ method: 'CASH', amount: '8000.00' }],
          fixture.actor.id,
        );
        expect(payment).toMatchObject({ student: null, walkIn, amount: '8000.00' });
        await expect(
          repository.findPage({ q: walkIn.name, page: 1, pageSize: 5 }),
        ).resolves.toMatchObject({ total: 1 });
        const corrected = await repository.correct(
          payment.id,
          { tenders: [{ method: 'MERCADO_PAGO', amount: '8000.00' }], paidAt: new Date() },
          fixture.actor.id,
          'Era Mercado Pago',
        );
        expect(corrected).toMatchObject({ student: null, walkIn, correctionOfId: payment.id });
        // La base no admite un pago sin alumno que no sea una clase suelta de un eventual.
        await expect(
          prisma.payment.create({
            data: {
              amount: '1000.00',
              kind: 'OTHER',
              concept: 'APPAREL',
              walkInName: 'Sin ficha',
              createdByUserId: fixture.actor.id,
            },
          }),
        ).rejects.toThrow(/payments_payer_check/);
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('saldo a favor: cobrar de más, desimputar un duplicado, aplicarlo y devolverlo', async () => {
      const fixture = await createFixture();
      try {
        // Debe 80.000 (agosto con recargo 41.000 + septiembre 40.000); paga 85.000 con permiso.
        await expect(
          repository.create(
            fixture.student.id,
            [{ method: 'CASH', amount: '85000.00' }],
            fixture.actor.id,
          ),
        ).rejects.toMatchObject({ code: 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE' });
        const over = await repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '85000.00' }],
          fixture.actor.id,
          undefined,
          undefined,
          undefined,
          true,
        );
        expect(over.creditAmount).toBe('4000.00');
        await expect(repository.creditTotal(fixture.student.id)).resolves.toBe('4000.00');
        // Sin cuotas pendientes no hay dónde usarlo.
        await expect(
          repository.applyCredit(fixture.student.id, fixture.actor.id, 'Usar saldo'),
        ).rejects.toMatchObject({ code: 'PAYMENT_NO_CREDIT' });
        // Con una cuota nueva, el saldo se usa en ella sin tocar la caja.
        const december = await prisma.monthlyCharge.create({
          data: {
            studentId: fixture.student.id,
            enrollmentId: fixture.enrollment.id,
            tariffId: fixture.tariff.id,
            period: new Date('2026-12-01T00:00:00.000Z'),
            baseAmount: '40000.00',
            discountAmount: '0.00',
            finalAmount: '40000.00',
            dueDate: new Date('2026-12-10T00:00:00.000Z'),
          },
        });
        const movementsBefore = await prisma.cashMovement.count({
          where: { cashShiftId: fixture.cashShift.id },
        });
        await expect(
          repository.applyCredit(fixture.student.id, fixture.actor.id, 'Usar saldo'),
        ).resolves.toEqual({ applied: '4000.00' });
        await expect(repository.creditTotal(fixture.student.id)).resolves.toBe('0.00');
        await expect(billing.findCharge(december.id)).resolves.toMatchObject({
          status: 'PARTIAL',
          outstandingAmount: '36000.00',
        });
        await expect(
          prisma.cashMovement.count({ where: { cashShiftId: fixture.cashShift.id } }),
        ).resolves.toBe(movementsBefore);

        // Un pago duplicado se desimputa entero: queda todo como saldo a favor.
        await repository.void(over.id, fixture.actor.id, 'Rehacer');
        const first = await repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '41000.00' }],
          fixture.actor.id,
        );
        const duplicate = await repository.create(
          fixture.student.id,
          [{ method: 'MERCADO_PAGO', amount: '40000.00' }],
          fixture.actor.id,
        );
        const unallocated = await repository.reallocate(
          duplicate.id,
          [],
          fixture.actor.id,
          'Pagó dos veces',
        );
        expect(unallocated).toMatchObject({ creditAmount: '40000.00', allocations: [] });
        await expect(billing.findCharge(fixture.secondCharge.id)).resolves.toMatchObject({
          status: 'PENDING',
        });

        // Se aplica la mitad a septiembre (sin caja) y se devuelve el resto por Mercado Pago.
        const applied = await repository.reallocate(
          duplicate.id,
          [{ monthlyChargeId: fixture.secondCharge.id, amount: '20000.00' }],
          fixture.actor.id,
          'Aplica saldo a septiembre',
        );
        expect(applied.creditAmount).toBe('20000.00');
        await expect(
          repository.refund(
            duplicate.id,
            { amount: '20000.01', method: 'MERCADO_PAGO', fromCashShift: false },
            fixture.actor.id,
            'Devolución',
          ),
        ).rejects.toMatchObject({ code: 'PAYMENT_REFUND_EXCEEDS_CREDIT' });
        // Por Mercado Pago la hace Dirección desde su cuenta: queda registrada fuera de la caja.
        await repository.refund(
          duplicate.id,
          { amount: '15000.00', method: 'MERCADO_PAGO', fromCashShift: false },
          fixture.actor.id,
          'Devolución del duplicado',
        );
        await expect(
          prisma.paymentRefund.findFirst({
            where: { paymentId: duplicate.id, method: 'MERCADO_PAGO' },
          }),
        ).resolves.toMatchObject({ cashShiftId: null });
        // El efectivo que sale de la caja es un egreso del turno de quien devuelve.
        const refunded = await repository.refund(
          duplicate.id,
          { amount: '5000.00', method: 'CASH', fromCashShift: true },
          fixture.actor.id,
          'Resto en efectivo',
        );
        expect(refunded).toMatchObject({ creditAmount: '0.00', refundedAmount: '20000.00' });
        const refundMovements = await prisma.cashMovement.findMany({
          where: { sourcePaymentId: duplicate.id, type: 'REFUND' },
        });
        expect(refundMovements).toHaveLength(1);
        expect(refundMovements[0]).toMatchObject({
          cashShiftId: fixture.cashShift.id,
          method: 'CASH',
          sourcePaymentTenderId: null,
        });
        expect(refundMovements[0]?.amount.toFixed(2)).toBe('5000.00');

        // Lo devuelto ya no se puede volver a imputar, y el pago no se anula ni se corrige.
        await expect(
          repository.reallocate(
            duplicate.id,
            [{ monthlyChargeId: fixture.secondCharge.id, amount: '40000.00' }],
            fixture.actor.id,
            'Intento',
          ),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
        await expect(repository.void(duplicate.id, fixture.actor.id, 'x')).rejects.toMatchObject({
          code: 'PAYMENT_REFUND_CONFLICT',
        });
        expect(first.creditAmount).toBe('0.00');
      } finally {
        await prisma.cashMovement.deleteMany({
          where: { sourcePayment: { studentId: fixture.student.id }, type: 'REFUND' },
        });
        await prisma.paymentRefund.deleteMany({
          where: { payment: { studentId: fixture.student.id } },
        });
        await cleanupFixture(fixture);
      }
    });

    it('rechaza un Payment sin turno abierto sin persistirlo', async () => {
      const fixture = await createFixture();
      try {
        await prisma.cashShift.delete({ where: { id: fixture.cashShift.id } });
        await expect(
          repository.create(
            fixture.student.id,
            [{ method: 'CASH', amount: '10000.00' }],
            fixture.actor.id,
          ),
        ).rejects.toMatchObject({ code: 'CASH_SHIFT_REQUIRED' });
        expect(await prisma.payment.count({ where: { studentId: fixture.student.id } })).toBe(0);
      } finally {
        await cleanupFixture(fixture);
      }
    });

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
          outstandingAmount: '31000.00',
          overdue: true,
        });
        await expect(
          receivables.list({
            scope: 'pending',
            q: fixture.student.dni,
            sort: 'oldest',
            page: 1,
            pageSize: 100,
          }),
        ).resolves.toMatchObject({
          items: expect.arrayContaining([
            expect.objectContaining({
              student: expect.objectContaining({ id: fixture.student.id }),
              openChargeCount: 2,
              outstandingAmount: '71000.00',
            }),
          ]),
        });
        const second = await repository.create(
          fixture.student.id,
          [{ method: 'MERCADO_PAGO', amount: '31000.00' }],
          fixture.actor.id,
        );
        await prisma.$transaction([
          prisma.cashShiftClosingLine.createMany({
            data: [
              {
                cashShiftId: fixture.cashShift.id,
                method: 'CASH',
                expectedAmount: '10000',
                declaredAmount: '10000',
                differenceAmount: '0',
              },
              {
                cashShiftId: fixture.cashShift.id,
                method: 'MERCADO_PAGO',
                expectedAmount: '31000',
                declaredAmount: '31000',
                differenceAmount: '0',
              },
              {
                cashShiftId: fixture.cashShift.id,
                method: 'CARD',
                expectedAmount: '0',
                declaredAmount: '0',
                differenceAmount: '0',
              },
            ],
          }),
          prisma.cashShift.update({
            where: { id: fixture.cashShift.id },
            data: { status: 'CLOSED', closedAt: new Date(), closedByUserId: fixture.actor.id },
          }),
        ]);
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
          await prisma.cashMovement.count({
            where: { sourcePaymentId: second.id, type: 'COLLECTION' },
          }),
        ).toBe(1);
        expect(
          await prisma.cashMovement.count({
            where: { sourcePaymentId: second.id, type: 'REVERSAL' },
          }),
        ).toBe(1);
        expect(
          await prisma.cashShiftClosingLine.findUnique({
            where: {
              cashShiftId_method: { cashShiftId: fixture.cashShift.id, method: 'MERCADO_PAGO' },
            },
            select: { expectedAmount: true },
          }),
        ).toEqual({ expectedAmount: new Prisma.Decimal('31000') });
        expect(
          (await prisma.monthlyCharge.findUnique({ where: { id: fixture.charge.id } }))?.status,
        ).toBe('PARTIAL');
        await expect(billing.findCharge(fixture.charge.id)).resolves.toMatchObject({
          paidAmount: '10000.00',
          outstandingAmount: '31000.00',
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
          outstandingAmount: '41000.00',
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
          await prisma.cashMovement.findMany({
            where: { sourcePaymentId: payment.id, type: 'COLLECTION' },
            orderBy: { method: 'asc' },
            select: { method: true, amount: true },
          }),
        ).toEqual([
          { method: 'CASH', amount: new Prisma.Decimal('30000') },
          { method: 'MERCADO_PAGO', amount: new Prisma.Decimal('20000') },
        ]);
        expect(
          payment.allocations.map(({ monthlyChargeId, amount }) => ({ monthlyChargeId, amount })),
        ).toEqual([
          { monthlyChargeId: fixture.charge.id, amount: '41000.00' },
          { monthlyChargeId: fixture.secondCharge.id, amount: '9000.00' },
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

    it('registra el recargo por tarjeta como otro cobro en el mismo turno', async () => {
      const fixture = await createFixture();
      try {
        const payment = await repository.create(
          fixture.student.id,
          [{ method: 'CARD', amount: '40000.00' }],
          fixture.actor.id,
          undefined,
          [fixture.secondCharge.id],
          '4000.00',
        );
        expect(payment.allocations).toEqual([
          expect.objectContaining({ monthlyChargeId: fixture.secondCharge.id, amount: '40000.00' }),
        ]);
        const surcharge = await prisma.payment.findFirstOrThrow({
          where: { studentId: fixture.student.id, concept: 'CARD_SURCHARGE' },
          include: { tenders: true, allocations: true },
        });
        expect(surcharge).toMatchObject({ kind: 'OTHER', status: 'CONFIRMED' });
        expect(surcharge.amount.toFixed(2)).toBe('4000.00');
        expect(surcharge.allocations).toEqual([]);
        expect(surcharge.tenders.map((tender) => tender.method)).toEqual(['CARD']);
        const movements = await prisma.cashMovement.findMany({
          where: { cashShiftId: fixture.cashShift.id },
          select: { method: true, amount: true },
        });
        expect(movements).toHaveLength(2);
        expect(movements.every((movement) => movement.method === 'CARD')).toBe(true);

        // Queda ligado al cobro: el recibo lo muestra y corregir el cobro pasa el vínculo.
        expect(payment.cardSurcharge).toEqual({ id: surcharge.id, amount: '4000.00' });
        const corrected = await repository.correct(
          payment.id,
          {
            tenders: [{ method: 'CARD', amount: '40000.00' }],
            paidAt: new Date('2026-08-30T15:00:00Z'),
          },
          fixture.actor.id,
          'Fecha real',
        );
        expect(corrected.cardSurcharge).toEqual({ id: surcharge.id, amount: '4000.00' });

        // Anular el cobro anula también su recargo, con la reversa en el turno.
        await repository.void(corrected.id, fixture.actor.id, 'No correspondía');
        await expect(
          prisma.payment.findUnique({ where: { id: surcharge.id }, select: { status: true } }),
        ).resolves.toEqual({ status: 'VOID' });
        await expect(
          prisma.cashMovement.count({ where: { sourcePaymentId: surcharge.id, type: 'REVERSAL' } }),
        ).resolves.toBe(1);
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('cobra solo la cuota elegida aunque haya una más vieja', async () => {
      const fixture = await createFixture();
      try {
        const payment = await repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '40000.00' }],
          fixture.actor.id,
          undefined,
          [fixture.secondCharge.id],
        );
        expect(payment.allocations).toEqual([
          expect.objectContaining({ monthlyChargeId: fixture.secondCharge.id, amount: '40000.00' }),
        ]);
        await expect(
          prisma.monthlyCharge.findUniqueOrThrow({ where: { id: fixture.charge.id } }),
        ).resolves.toMatchObject({ status: 'PENDING' });
        await expect(
          repository.create(
            fixture.student.id,
            [{ method: 'CASH', amount: '1000.00' }],
            fixture.actor.id,
            undefined,
            [fixture.secondCharge.id],
          ),
        ).rejects.toMatchObject({ code: 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE' });
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('reimputa un pago sin tocar la caja y lo conserva al corregirlo o anularlo', async () => {
      const fixture = await createFixture();
      try {
        // Agosto vencido: el cobro de 40.000 va a agosto (con recargo queda parcial).
        const original = await repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '40000.00' }],
          fixture.actor.id,
        );
        expect(original.allocations).toEqual([
          expect.objectContaining({ monthlyChargeId: fixture.charge.id, amount: '40000.00' }),
        ]);
        const moved = await repository.reallocate(
          original.id,
          [{ monthlyChargeId: fixture.secondCharge.id, amount: '40000.00' }],
          fixture.actor.id,
          'Venía a pagar septiembre',
        );
        expect(moved).toMatchObject({ id: original.id, status: 'CONFIRMED', amount: '40000.00' });
        expect(moved.allocations).toEqual([
          expect.objectContaining({ monthlyChargeId: fixture.secondCharge.id, amount: '40000.00' }),
        ]);
        const statuses = async () =>
          (
            await prisma.monthlyCharge.findMany({
              where: { id: { in: [fixture.charge.id, fixture.secondCharge.id] } },
              select: { id: true, status: true },
            })
          ).reduce<Record<string, string>>(
            (all, charge) => ({ ...all, [charge.id]: charge.status }),
            {},
          );
        expect(await statuses()).toEqual({
          [fixture.charge.id]: 'PENDING',
          [fixture.secondCharge.id]: 'PAID',
        });
        // La caja no cambia y la imputación original sigue guardada.
        expect(await prisma.cashMovement.count({ where: { sourcePaymentId: original.id } })).toBe(
          1,
        );
        expect(
          await prisma.paymentAllocation.count({
            where: { paymentId: original.id, reallocationId: null },
          }),
        ).toBe(1);
        await expect(
          prisma.auditLog.findFirst({ where: { entityId: original.id, action: 'UPDATE' } }),
        ).resolves.toMatchObject({
          reason: 'Venía a pagar septiembre',
          metadata: expect.objectContaining({ source: 'PAYMENT_REALLOCATION' }),
        });
        // Pedir la misma imputación que ya tiene no registra nada.
        await expect(
          repository.reallocate(
            original.id,
            [{ monthlyChargeId: fixture.secondCharge.id, amount: '40000.00' }],
            fixture.actor.id,
            'igual',
          ),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

        // Corregir el medio conserva la imputación vigente (septiembre).
        const corrected = await repository.correct(
          original.id,
          { tenders: [{ method: 'CARD', amount: '40000.00' }], paidAt: new Date(original.paidAt) },
          fixture.actor.id,
          'Era tarjeta',
        );
        expect(corrected.allocations).toEqual([
          expect.objectContaining({ monthlyChargeId: fixture.secondCharge.id, amount: '40000.00' }),
        ]);
        expect(await statuses()).toEqual({
          [fixture.charge.id]: 'PENDING',
          [fixture.secondCharge.id]: 'PAID',
        });
        await repository.void(corrected.id, fixture.actor.id, 'Prueba');
        expect(await statuses()).toEqual({
          [fixture.charge.id]: 'PENDING',
          [fixture.secondCharge.id]: 'PENDING',
        });
        await expect(
          repository.reallocate(
            corrected.id,
            [{ monthlyChargeId: fixture.charge.id, amount: '40000.00' }],
            fixture.actor.id,
            'anulado',
          ),
        ).rejects.toMatchObject({ code: 'PAYMENT_ALREADY_VOID' });
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('corrige el medio de pago en el mismo turno y conserva las cuotas', async () => {
      const fixture = await createFixture();
      try {
        const original = await repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '41000.00' }],
          fixture.actor.id,
        );
        const corrected = await repository.correct(
          original.id,
          {
            tenders: [{ method: 'MERCADO_PAGO', amount: '41000.00' }],
            paidAt: new Date(original.paidAt),
          },
          fixture.actor.id,
          'Era Mercado Pago',
        );
        expect(corrected).toMatchObject({
          status: 'CONFIRMED',
          amount: '41000.00',
          correctionOfId: original.id,
          tenders: [{ method: 'MERCADO_PAGO', amount: '41000.00' }],
          allocations: [{ monthlyChargeId: fixture.charge.id, amount: '41000.00' }],
        });
        await expect(repository.findById(original.id)).resolves.toMatchObject({
          status: 'VOID',
          correctedById: corrected.id,
        });
        // En el turno: el efectivo se revierte y entra como Mercado Pago (la reversa y el nuevo
        // cobro se crean en la misma transacción, así que se comparan sin orden).
        const movements = await prisma.cashMovement.findMany({
          where: { cashShiftId: fixture.cashShift.id },
          select: { type: true, method: true, amount: true },
        });
        expect(movements).toHaveLength(3);
        expect(movements).toEqual(
          expect.arrayContaining([
            { type: 'COLLECTION', method: 'CASH', amount: new Prisma.Decimal('41000') },
            { type: 'REVERSAL', method: 'CASH', amount: new Prisma.Decimal('41000') },
            { type: 'COLLECTION', method: 'MERCADO_PAGO', amount: new Prisma.Decimal('41000') },
          ]),
        );
        await expect(
          prisma.monthlyCharge.findUniqueOrThrow({ where: { id: fixture.charge.id } }),
        ).resolves.toMatchObject({ status: 'PAID' });
        await expect(
          repository.correct(
            original.id,
            { tenders: [{ method: 'CARD', amount: '41000.00' }], paidAt: new Date() },
            fixture.actor.id,
            'otra vez',
          ),
        ).rejects.toMatchObject({ code: 'PAYMENT_ALREADY_VOID' });
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('pasa una cuota pagada a la nueva clase del alumno sin tocar el pago', async () => {
      const fixture = await createFixture();
      const otherClass = await prisma.academyClass.create({
        data: {
          name: `Otra clase ${crypto.randomUUID()}`,
          danceTypeId: fixture.danceType.id,
          teacherId: fixture.teacher.id,
          capacity: 10,
        },
      });
      const otherEnrollment = await prisma.enrollment.create({
        data: {
          studentId: fixture.student.id,
          classId: otherClass.id,
          startDate: new Date('2026-08-15T00:00:00.000Z'),
        },
      });
      try {
        const payment = await repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '41000.00' }],
          fixture.actor.id,
        );
        await adjustments.moveToEnrollment(
          fixture.charge.id,
          otherEnrollment.id,
          'Se cambió de clase',
          fixture.actor.id,
        );
        await expect(
          prisma.monthlyCharge.findUniqueOrThrow({ where: { id: fixture.charge.id } }),
        ).resolves.toMatchObject({ enrollmentId: otherEnrollment.id, status: 'PAID' });
        await expect(repository.findById(payment.id)).resolves.toMatchObject({
          status: 'CONFIRMED',
          allocations: [expect.objectContaining({ monthlyChargeId: fixture.charge.id })],
        });
      } finally {
        await prisma.monthlyCharge.update({
          where: { id: fixture.charge.id },
          data: { enrollmentId: fixture.enrollment.id },
        });
        await prisma.enrollment.delete({ where: { id: otherEnrollment.id } });
        await prisma.academyClass.delete({ where: { id: otherClass.id } });
        await cleanupFixture(fixture);
      }
    });

    it('un pago cargado tarde con fecha anterior al vencimiento no lleva recargo', async () => {
      const fixture = await createFixture();
      try {
        const payment = await repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '40000.00' }],
          fixture.actor.id,
          new Date('2026-08-05T15:00:00.000Z'),
        );
        expect(payment.paidAt).toBe('2026-08-05T15:00:00.000Z');
        expect(payment.allocations).toEqual([
          expect.objectContaining({ monthlyChargeId: fixture.charge.id, amount: '40000.00' }),
        ]);
        expect(
          await prisma.monthlyChargeAdjustment.count({
            where: { monthlyChargeId: fixture.charge.id, type: 'LATE_FEE' },
          }),
        ).toBe(0);
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('si cambia el importe vuelve a imputar de la cuota más vieja', async () => {
      const fixture = await createFixture();
      try {
        const original = await repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '41000.00' }],
          fixture.actor.id,
        );
        const corrected = await repository.correct(
          original.id,
          { tenders: [{ method: 'CASH', amount: '50000.00' }], paidAt: new Date(original.paidAt) },
          fixture.actor.id,
          'Pagó también parte de septiembre',
        );
        expect(
          corrected.allocations.map(({ monthlyChargeId, amount }) => ({ monthlyChargeId, amount })),
        ).toEqual([
          { monthlyChargeId: fixture.charge.id, amount: '41000.00' },
          { monthlyChargeId: fixture.secondCharge.id, amount: '9000.00' },
        ]);
        await expect(
          repository.correct(
            corrected.id,
            { tenders: [{ method: 'CASH', amount: '999999.00' }], paidAt: new Date() },
            fixture.actor.id,
            'demasiado',
          ),
        ).rejects.toMatchObject({ code: 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE' });
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('cobra primero la deuda histórica y no le suma recargo', async () => {
      const fixture = await createFixture();
      try {
        const debt = await billing.createHistoricalDebt(
          {
            studentId: fixture.student.id,
            enrollmentId: fixture.enrollment.id,
            amount: '100000.00',
            description: 'Deuda anterior ControlFit',
            period: '2026-07-01',
            dueDate: '2026-07-01',
          },
          fixture.actor.id,
        );
        // Vencida desde julio, pero sin recargo proyectado.
        expect(debt).toMatchObject({
          kind: 'HISTORICAL_DEBT',
          tariff: null,
          outstandingAmount: '100000.00',
          overdue: true,
        });
        const payment = await repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '120000.00' }],
          fixture.actor.id,
        );
        expect(
          payment.allocations.map(({ monthlyChargeId, amount, kind }) => ({
            monthlyChargeId,
            amount,
            kind,
          })),
        ).toEqual([
          { monthlyChargeId: debt.id, amount: '100000.00', kind: 'HISTORICAL_DEBT' },
          { monthlyChargeId: fixture.charge.id, amount: '20000.00', kind: 'MONTHLY' },
        ]);
        expect(
          await prisma.monthlyChargeAdjustment.count({ where: { monthlyChargeId: debt.id } }),
        ).toBe(0);
        // Agosto sí lleva su recargo: 41.000 - 20.000 + septiembre 40.000.
        await expect(
          receivables.list({
            scope: 'pending',
            q: fixture.student.dni,
            sort: 'oldest',
            page: 1,
            pageSize: 25,
          }),
        ).resolves.toMatchObject({ summary: { totalOutstanding: '61000.00' } });
        expect(
          await prisma.auditLog.findFirst({
            where: { entityId: debt.id, action: 'CREATE' },
            select: { metadata: true },
          }),
        ).toEqual({ metadata: { source: 'HISTORICAL_DEBT' } });
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('filtra cuentas e historial global sobre saldos y tenders reales', async () => {
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
            totalOutstanding: '31000.00',
          },
          items: [
            expect.objectContaining({
              student: expect.objectContaining({ id: fixture.student.id }),
              paidAmount: '10000.00',
              outstandingAmount: '31000.00',
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
          summary: { totalCharges: 1, overdueCharges: 1, totalOutstanding: '31000.00' },
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
        for (const q of [
          `${fixture.student.firstName} ${fixture.student.lastName}`,
          fixture.student.dni,
        ]) {
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
            from: new Date(new Date(mixed.paidAt).getTime() - 1_000),
            toExclusive: new Date(new Date(mixed.paidAt).getTime() + 1_000),
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
          summary: { totalCharges: 2, totalPaid: '0.00', totalOutstanding: '81000.00' },
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
        await cleanupFixture(fixture);
      }
    });

    it('no suma recargo a una cuota que nace vencida', async () => {
      const fixture = await createFixture();
      try {
        // Cuota de julio generada el 31/08, ya vencida (alumno nuevo o deuda cargada tarde).
        const july = await prisma.monthlyCharge.create({
          data: {
            studentId: fixture.student.id,
            enrollmentId: fixture.enrollment.id,
            tariffId: fixture.tariff.id,
            period: new Date('2026-07-01T00:00:00.000Z'),
            baseAmount: '40000.00',
            discountAmount: '0.00',
            finalAmount: '40000.00',
            dueDate: new Date('2026-07-10T00:00:00.000Z'),
            createdAt: new Date('2026-08-31T15:00:00.000Z'),
          },
        });
        await expect(billing.findCharge(july.id)).resolves.toMatchObject({
          studentDueAmount: '40000.00',
          outstandingAmount: '40000.00',
          overdue: true,
        });
        // Agosto (generada a tiempo) sí proyecta su recargo.
        await expect(
          receivables.list({
            scope: 'pending',
            q: fixture.student.dni,
            sort: 'oldest',
            page: 1,
            pageSize: 25,
          }),
        ).resolves.toMatchObject({ summary: { totalOutstanding: '121000.00' } });
        const payment = await repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '40000.00' }],
          fixture.actor.id,
        );
        expect(payment.allocations).toEqual([
          expect.objectContaining({ monthlyChargeId: july.id, amount: '40000.00' }),
        ]);
        expect(
          await prisma.monthlyChargeAdjustment.count({ where: { monthlyChargeId: july.id } }),
        ).toBe(0);
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('quita el recargo proyectado y no lo vuelve a sumar al cobrar', async () => {
      const fixture = await createFixture();
      try {
        await expect(
          adjustments.waiveLateFee(fixture.charge.id, 'No correspondía', {
            ...fixture.actor,
            role: 'RECEPTION',
          }),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        await expect(
          adjustments.waiveLateFee(fixture.secondCharge.id, 'Todavía no vence', fixture.actor),
        ).rejects.toMatchObject({ code: 'LATE_FEE_NOT_APPLICABLE' });
        await adjustments.waiveLateFee(fixture.charge.id, 'No correspondía', fixture.actor);
        await expect(billing.findCharge(fixture.charge.id)).resolves.toMatchObject({
          studentDueAmount: '40000.00',
          outstandingAmount: '40000.00',
        });
        await expect(
          adjustments.waiveLateFee(fixture.charge.id, 'Otra vez', fixture.actor),
        ).rejects.toMatchObject({ code: 'LATE_FEE_ALREADY_WAIVED' });
        const payment = await repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '40000.00' }],
          fixture.actor.id,
        );
        expect(payment.allocations).toEqual([
          expect.objectContaining({ monthlyChargeId: fixture.charge.id, amount: '40000.00' }),
        ]);
        expect(
          await prisma.monthlyCharge.findUnique({
            where: { id: fixture.charge.id },
            select: { status: true },
          }),
        ).toEqual({ status: 'PAID' });
        expect(
          await prisma.monthlyChargeAdjustment.findMany({
            where: { monthlyChargeId: fixture.charge.id },
            orderBy: { createdAt: 'asc' },
            select: { type: true },
          }),
        ).toEqual([{ type: 'LATE_FEE' }, { type: 'REVERSAL' }]);
        expect(
          await prisma.auditLog.findFirst({
            where: { actorUserId: fixture.actor.id, action: 'CORRECTION' },
            select: { reason: true, metadata: true },
          }),
        ).toEqual({
          reason: 'No correspondía',
          metadata: { monthlyChargeId: fixture.charge.id, source: 'LATE_FEE_WAIVER' },
        });
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('un recargo ya cobrado se quita después de anular el pago', async () => {
      const fixture = await createFixture();
      try {
        const payment = await repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '41000.00' }],
          fixture.actor.id,
        );
        await expect(
          adjustments.waiveLateFee(fixture.charge.id, 'No correspondía', fixture.actor),
        ).rejects.toMatchObject({ code: 'ADJUSTMENT_WOULD_CREATE_CREDIT' });
        await repository.void(payment.id, fixture.actor.id, 'Recargo indebido');
        await adjustments.waiveLateFee(fixture.charge.id, 'No correspondía', fixture.actor);
        await expect(billing.findCharge(fixture.charge.id)).resolves.toMatchObject({
          paidAmount: '0.00',
          outstandingAmount: '40000.00',
        });
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('cambia el vencimiento dentro del mes y no mueve un recargo ya guardado', async () => {
      const fixture = await createFixture();
      try {
        // Hoy (31/08) agosto está vencida y proyecta recargo; con el nuevo vencimiento, no.
        await adjustments.changeDueDate(
          fixture.charge.id,
          '2026-08-31',
          'Paga el último día del mes',
          fixture.actor.id,
        );
        await expect(billing.findCharge(fixture.charge.id)).resolves.toMatchObject({
          dueDate: '2026-08-31',
          outstandingAmount: '40000.00',
          overdue: false,
        });
        expect(
          await prisma.auditLog.findFirst({
            where: { entityId: fixture.charge.id, action: 'UPDATE' },
            select: { reason: true, before: true, after: true },
          }),
        ).toEqual({
          reason: 'Paga el último día del mes',
          before: { dueDate: '2026-08-10' },
          after: { dueDate: '2026-08-31' },
        });
        await expect(
          adjustments.changeDueDate(fixture.charge.id, '2026-09-05', 'Otro mes', fixture.actor.id),
        ).rejects.toMatchObject({ code: 'INVALID_DUE_DATE' });

        // Con el recargo ya guardado (cobro parcial de una cuota vencida) no se cambia.
        await adjustments.changeDueDate(
          fixture.charge.id,
          '2026-08-10',
          'Volvió al día 10',
          fixture.actor.id,
        );
        await repository.create(
          fixture.student.id,
          [{ method: 'CASH', amount: '10000.00' }],
          fixture.actor.id,
        );
        await expect(
          adjustments.changeDueDate(fixture.charge.id, '2026-08-31', 'Tarde', fixture.actor.id),
        ).rejects.toMatchObject({ code: 'LATE_FEE_ALREADY_APPLIED' });
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('genera la cuota con la modalidad y el día de pago de la inscripción', async () => {
      const fixture = await createFixture();
      try {
        const reduced = await prisma.tariff.create({
          data: {
            classId: fixture.academicClass.id,
            name: 'Reducida',
            amount: '25000.00',
            validFrom: new Date('2026-08-01T00:00:00.000Z'),
          },
        });
        const reception = { id: fixture.actor.id, canBackfill: false };
        // Dos tarifas vigentes y sin modalidad elegida: no se adivina.
        await expect(
          generation.preview({ enrollmentId: fixture.enrollment.id, period: '2026-10' }, reception),
        ).rejects.toMatchObject({ code: 'TARIFF_AMBIGUOUS_FOR_PERIOD' });

        await expect(
          enrollments.updateBillingTerms(
            fixture.enrollment.id,
            { tariffId: reduced.id, paymentDueDay: 31 },
            fixture.actor.id,
          ),
        ).resolves.toMatchObject({
          paymentDueDay: 31,
          tariff: { id: reduced.id, name: 'Reducida', amount: '25000.00' },
        });
        await generation.generate(
          { enrollmentId: fixture.enrollment.id, period: '2026-10' },
          reception,
        );
        expect(
          await prisma.monthlyCharge.findFirst({
            where: {
              enrollmentId: fixture.enrollment.id,
              period: new Date('2026-10-01T00:00:00.000Z'),
            },
            select: { tariffId: true, baseAmount: true, dueDate: true },
          }),
        ).toEqual({
          tariffId: reduced.id,
          baseAmount: new Prisma.Decimal('25000'),
          dueDate: new Date('2026-10-31T00:00:00.000Z'),
        });
        // La modalidad tiene que ser una tarifa activa de la clase.
        const inactive = await prisma.tariff.create({
          data: {
            classId: fixture.academicClass.id,
            name: 'Vieja',
            amount: '20000.00',
            validFrom: new Date('2026-08-01T00:00:00.000Z'),
            status: 'INACTIVE',
          },
        });
        await expect(
          enrollments.updateBillingTerms(fixture.enrollment.id, { tariffId: inactive.id }),
        ).rejects.toMatchObject({ code: 'TARIFF_INACTIVE' });
      } finally {
        await cleanupFixture(fixture);
      }
    });
  },
  integrationTestTimeoutMs,
);
