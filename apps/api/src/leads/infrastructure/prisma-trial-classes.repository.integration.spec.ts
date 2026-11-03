import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import {
  integrationTestTimeoutMs,
  prismaTransactionOptions,
} from '../../database/prisma-transaction-options';
import { integrationDatabaseEnabled } from '../../database/integration-database';
import { PrismaTrialClassesRepository } from './prisma-trial-classes.repository';

describe.runIf(integrationDatabaseEnabled)(
  'Clases de prueba de potenciales alumnos',
  () => {
    const prisma = new PrismaClient({ transactionOptions: prismaTransactionOptions });
    const repository = new PrismaTrialClassesRepository(prisma as unknown as PrismaService);

    const createFixture = async () => {
      const token = crypto.randomUUID();
      const digits = [...token.replaceAll('-', '')]
        .map((character) => character.charCodeAt(0) % 10)
        .join('');
      const user = await prisma.adminUser.create({
        data: {
          username: `trials-test-${token}`,
          passwordHash: 'integration-test-not-a-real-password',
          role: 'RECEPTION',
        },
      });
      const teacher = await prisma.teacher.create({
        data: { dni: `6${digits.slice(0, 20)}`, firstName: 'Profe', lastName: `Prueba ${token}` },
      });
      const danceType = await prisma.danceType.create({
        data: { name: `Kizomba ${token}`, normalizedName: `trials-test-${token}` },
      });
      const academyClass = await prisma.academyClass.create({
        data: {
          name: `Kizomba ${token}`,
          danceTypeId: danceType.id,
          teacherId: teacher.id,
          capacity: 20,
        },
      });
      const lead = await prisma.lead.create({
        data: { name: `Lucía ${token}`, source: 'INSTAGRAM', status: 'INQUIRY' },
      });
      return { user, teacher, danceType, academyClass, lead };
    };
    type Fixture = Awaited<ReturnType<typeof createFixture>>;
    const cleanupFixture = async (fixture: Fixture) => {
      await prisma.auditLog.deleteMany({ where: { actorUserId: fixture.user.id } });
      await prisma.leadTrialClass.deleteMany({ where: { leadId: fixture.lead.id } });
      await prisma.lead.deleteMany({ where: { id: fixture.lead.id } });
      await prisma.academyClass.deleteMany({ where: { id: fixture.academyClass.id } });
      await prisma.danceType.deleteMany({ where: { id: fixture.danceType.id } });
      await prisma.teacher.deleteMany({ where: { id: fixture.teacher.id } });
      await prisma.adminUser.deleteMany({ where: { id: fixture.user.id } });
    };

    beforeAll(() => prisma.$connect());
    afterAll(() => prisma.$disconnect());

    it('registra una prueba por clase, la marca en el potencial alumno y se puede quitar', async () => {
      const fixture = await createFixture();
      try {
        const input = { classId: fixture.academyClass.id, trialDate: '2026-10-30', notes: null };
        const trial = await repository.create(fixture.lead.id, input, fixture.user.id);
        expect(trial).toMatchObject({
          academicClass: { id: fixture.academyClass.id },
          trialDate: '2026-10-30',
          createdBy: { id: fixture.user.id },
        });
        await expect(
          prisma.lead.findUnique({ where: { id: fixture.lead.id }, select: { status: true } }),
        ).resolves.toEqual({ status: 'TRIAL' });

        // La misma clase no se prueba dos veces, ni aunque se carguen a la vez.
        const repeated = await Promise.allSettled([
          repository.create(
            fixture.lead.id,
            { ...input, trialDate: '2026-11-01' },
            fixture.user.id,
          ),
          repository.create(
            fixture.lead.id,
            { ...input, trialDate: '2026-11-02' },
            fixture.user.id,
          ),
        ]);
        for (const result of repeated)
          expect(result).toMatchObject({
            status: 'rejected',
            reason: {
              code: 'TRIAL_CLASS_CONFLICT',
              message: expect.stringContaining('30/10/2026'),
            },
          });
        await expect(repository.list(fixture.lead.id)).resolves.toHaveLength(1);

        await repository.remove(
          fixture.lead.id,
          trial.id,
          'Se cargó a otra persona',
          fixture.user.id,
        );
        await expect(repository.list(fixture.lead.id)).resolves.toHaveLength(0);
        await expect(
          prisma.auditLog.findFirst({
            where: { entityId: trial.id, action: 'DELETE' },
            select: { reason: true },
          }),
        ).resolves.toEqual({ reason: 'Se cargó a otra persona' });
      } finally {
        await cleanupFixture(fixture);
      }
    });
  },
  integrationTestTimeoutMs,
);
