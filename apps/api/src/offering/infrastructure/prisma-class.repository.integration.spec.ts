import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import {
  integrationTestTimeoutMs,
  prismaTransactionOptions,
} from '../../database/prisma-transaction-options';
import { integrationDatabaseEnabled } from '../../database/integration-database';
import { PrismaTeacherRepository } from '../../teachers/infrastructure/prisma-teacher.repository';
import { ClassesService } from '../application/classes.service';
import { PrismaClassRepository } from './prisma-class.repository';

describe.runIf(integrationDatabaseEnabled)(
  'Profesores adicionales de una clase',
  () => {
    const prisma = new PrismaClient({ transactionOptions: prismaTransactionOptions });
    const service = new ClassesService(new PrismaClassRepository(prisma as PrismaService));
    const teachers = new PrismaTeacherRepository(prisma as PrismaService);

    const createFixture = async () => {
      const token = crypto.randomUUID();
      const digits = [...token.replaceAll('-', '')]
        .map((character) => character.charCodeAt(0) % 10)
        .join('');
      const teacher = (index: number, firstName: string) =>
        prisma.teacher.create({
          data: { dni: `${index}${digits.slice(0, 20)}`, firstName, lastName: `Prueba ${token}` },
        });
      const [fernando, sofia, anabella] = await Promise.all([
        teacher(1, 'Fernando'),
        teacher(2, 'Sofía'),
        teacher(3, 'Anabella'),
      ]);
      const actor = await prisma.adminUser.create({
        data: {
          username: `classes-test-${token}`,
          passwordHash: 'integration-test-not-a-real-password',
          role: 'MANAGER',
        },
      });
      const danceType = await prisma.danceType.create({
        data: { name: `Formación ${token}`, normalizedName: `classes-test-${token}` },
      });
      const branch = await prisma.branch.create({
        data: { name: `Sede ${token}`, address: 'Calle falsa 123' },
      });
      const room = await prisma.room.create({
        data: { name: `Salón ${token}`, capacity: 20, branchId: branch.id },
      });
      return { token, fernando, sofia, anabella, actor, danceType, branch, room };
    };
    type Fixture = Awaited<ReturnType<typeof createFixture>>;
    const cleanupFixture = async (fixture: Fixture) => {
      const classIds = (
        await prisma.academyClass.findMany({
          where: { danceTypeId: fixture.danceType.id },
          select: { id: true },
        })
      ).map(({ id }) => id);
      await prisma.auditLog.deleteMany({ where: { actorUserId: fixture.actor.id } });
      await prisma.classSchedule.deleteMany({ where: { classId: { in: classIds } } });
      await prisma.academyClass.deleteMany({ where: { id: { in: classIds } } });
      await prisma.room.delete({ where: { id: fixture.room.id } });
      await prisma.branch.delete({ where: { id: fixture.branch.id } });
      await prisma.danceType.delete({ where: { id: fixture.danceType.id } });
      await prisma.adminUser.delete({ where: { id: fixture.actor.id } });
      await prisma.teacher.deleteMany({
        where: { id: { in: [fixture.fernando.id, fixture.sofia.id, fixture.anabella.id] } },
      });
    };

    beforeAll(() => prisma.$connect());
    afterAll(() => prisma.$disconnect());

    it('guarda, filtra, edita y audita los profesores adicionales', async () => {
      const fixture = await createFixture();
      try {
        const created = await service.create({
          name: `Formación Docente ${fixture.token}`,
          danceTypeId: fixture.danceType.id,
          teacherId: fixture.fernando.id,
          additionalTeacherIds: [fixture.sofia.id, fixture.anabella.id],
          capacity: 20,
          schedules: [
            {
              dayOfWeek: 'SATURDAY',
              startTime: '10:00',
              endTime: '12:00',
              roomId: fixture.room.id,
            },
          ],
        });
        expect(created.teacher.id).toBe(fixture.fernando.id);
        expect(created.additionalTeachers.map(({ firstName }) => firstName).sort()).toEqual([
          'Anabella',
          'Sofía',
        ]);

        // Filtrar por profesor encuentra la clase también para un adicional.
        await expect(
          service.list({ teacherId: fixture.sofia.id, page: 1, pageSize: 25 }),
        ).resolves.toMatchObject({ total: 1, items: [{ id: created.id }] });

        // No se puede desactivar a un adicional de una clase activa.
        await expect(teachers.hasActiveClasses(fixture.anabella.id)).resolves.toBe(true);

        const updated = await service.update(
          created.id,
          { additionalTeacherIds: [fixture.anabella.id] },
          fixture.actor.id,
        );
        expect(updated.additionalTeachers.map(({ id }) => id)).toEqual([fixture.anabella.id]);
        await expect(teachers.hasActiveClasses(fixture.sofia.id)).resolves.toBe(false);
        const audit = await prisma.auditLog.findFirst({
          where: { entityId: created.id, action: 'UPDATE' },
          select: { before: true, after: true },
        });
        expect(audit?.after).toMatchObject({ additionalTeacherIds: [fixture.anabella.id] });
        expect(
          (audit?.before as { additionalTeacherIds: string[] }).additionalTeacherIds.sort(),
        ).toEqual([fixture.sofia.id, fixture.anabella.id].sort());
      } finally {
        await cleanupFixture(fixture);
      }
    });

    it('borra una clase de prueba sin registros y rechaza una con registros', async () => {
      const fixture = await createFixture();
      const lead = await prisma.lead.create({
        data: { name: `Prueba ${fixture.token}`, source: 'IN_PERSON' },
      });
      try {
        const classInput = (name: string, startTime: string, endTime: string) => ({
          name: `${name} ${fixture.token}`,
          danceTypeId: fixture.danceType.id,
          teacherId: fixture.fernando.id,
          additionalTeacherIds: [fixture.sofia.id],
          capacity: 20,
          schedules: [
            { dayOfWeek: 'MONDAY' as const, startTime, endTime, roomId: fixture.room.id },
          ],
        });
        const test = await service.create(classInput('Clase de prueba', '10:00', '11:00'));
        await prisma.tariff.create({
          data: { classId: test.id, name: 'Mensual', amount: 1, validFrom: new Date('2026-01-01') },
        });
        await expect(service.remove(test.id, ' ', fixture.actor.id)).rejects.toMatchObject({
          details: { field: 'reason' },
        });
        await service.remove(test.id, 'Creada en las pruebas', fixture.actor.id);
        await expect(
          prisma.academyClass.findUnique({ where: { id: test.id } }),
        ).resolves.toBeNull();
        await expect(
          prisma.auditLog.findFirst({
            where: { entityId: test.id, action: 'DELETE', entityType: 'CLASS' },
            select: { reason: true, before: true },
          }),
        ).resolves.toMatchObject({
          reason: 'Creada en las pruebas',
          before: { additionalTeacherIds: [fixture.sofia.id], tariffs: [{ name: 'Mensual' }] },
        });

        const used = await service.create(classInput('Clase usada', '12:00', '13:00'));
        await prisma.leadTrialClass.create({
          data: {
            leadId: lead.id,
            classId: used.id,
            trialDate: new Date('2026-10-30'),
            createdByUserId: fixture.actor.id,
          },
        });
        await expect(service.remove(used.id, 'Probar', fixture.actor.id)).rejects.toMatchObject({
          code: 'CLASS_IN_USE',
          details: { trialClasses: 1 },
        });
        await expect(
          prisma.academyClass.findUnique({ where: { id: used.id } }),
        ).resolves.not.toBeNull();
      } finally {
        await prisma.leadTrialClass.deleteMany({ where: { leadId: lead.id } });
        await prisma.lead.delete({ where: { id: lead.id } });
        await prisma.classAdditionalTeacher.deleteMany({
          where: { class: { danceTypeId: fixture.danceType.id } },
        });
        await prisma.tariff.deleteMany({ where: { class: { danceTypeId: fixture.danceType.id } } });
        await cleanupFixture(fixture);
      }
    });
  },
  integrationTestTimeoutMs,
);
