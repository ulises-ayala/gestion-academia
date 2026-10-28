import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import {
  integrationTestTimeoutMs,
  prismaTransactionOptions,
} from '../../database/prisma-transaction-options';
import { integrationDatabaseEnabled } from '../../database/integration-database';
import { EnrollmentsService } from '../application/enrollments.service';
import { PrismaEnrollmentRepository } from './prisma-enrollment.repository';

// Explicit opt-in; never load a developer's .env or run fixtures on the academy database.
describe.runIf(integrationDatabaseEnabled)(
  'Enrollment class change and start date on PostgreSQL',
  () => {
    const db = new PrismaClient({ transactionOptions: prismaTransactionOptions });
    const service = new EnrollmentsService(new PrismaEnrollmentRepository(db as PrismaService));
    const token = crypto.randomUUID();
    let teacherId: string;
    let danceTypeId: string;
    let actorId: string;
    beforeAll(async () => {
      teacherId = (
        await db.teacher.create({
          data: { dni: token.slice(0, 30), firstName: 'Luz', lastName: 'Docente' },
        })
      ).id;
      danceTypeId = (await db.danceType.create({ data: { name: token, normalizedName: token } }))
        .id;
      actorId = (
        await db.adminUser.create({
          data: { username: token, passwordHash: 'test-only', role: 'RECEPTION' },
        })
      ).id;
    });
    afterAll(async () => db.$disconnect());
    const student = () =>
      db.student.create({
        data: {
          firstName: 'Ana',
          lastName: `Pérez ${token}`,
          dni: BigInt(`0x${crypto.randomUUID().replaceAll('-', '')}`)
            .toString()
            .slice(0, 32),
        },
      });
    const academicClass = (capacity = 30) =>
      db.academyClass.create({
        data: { name: `Salsa ${crypto.randomUUID()}`, teacherId, danceTypeId, capacity },
      });
    async function activeEnrollment() {
      const owner = await student();
      const from = await academicClass();
      return db.enrollment.create({
        data: { studentId: owner.id, classId: from.id, startDate: new Date('2026-08-01') },
      });
    }
    const change = (id: string, classId: string, actor = actorId) =>
      service.changeClass(
        id,
        { classId, changeDate: '2026-10-15', endReason: 'SCHEDULE_CHANGE', endNote: ' Turno ' },
        actor,
      );

    it('finaliza la actual el día previo, inscribe en la nueva y audita CLASS_CHANGE', async () => {
      const item = await activeEnrollment();
      const target = await academicClass();
      const result = await change(item.id, target.id);
      expect(result.ended).toMatchObject({
        id: item.id,
        status: 'ENDED',
        endDate: '2026-10-14',
        endReason: 'SCHEDULE_CHANGE',
        endNote: 'Turno',
      });
      expect(result.created).toMatchObject({
        studentId: item.studentId,
        classId: target.id,
        startDate: '2026-10-15',
        status: 'ACTIVE',
      });
      const logs = await db.auditLog.findMany({ where: { entityId: item.id } });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: 'CLASS_CHANGE',
        entityType: 'ENROLLMENT',
        actorUserId: actorId,
        before: { classId: item.classId, status: 'ACTIVE' },
        after: { classId: target.id, status: 'ENDED', endDate: '2026-10-14' },
        metadata: { studentId: item.studentId, newEnrollmentId: result.created.id },
      });
    });
    it('no cambia nada si la clase nueva está llena', async () => {
      const item = await activeEnrollment();
      const target = await academicClass(1);
      await db.enrollment.create({
        data: { studentId: (await student()).id, classId: target.id, startDate: new Date() },
      });
      await expect(change(item.id, target.id)).rejects.toMatchObject({ code: 'CLASS_FULL' });
      expect(await db.enrollment.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({
        status: 'ACTIVE',
        endDate: null,
      });
      expect(await db.enrollment.count({ where: { studentId: item.studentId } })).toBe(1);
      expect(await db.auditLog.count({ where: { entityId: item.id } })).toBe(0);
    });
    it('revierte el cambio si la auditoría no se puede guardar', async () => {
      const item = await activeEnrollment();
      const target = await academicClass();
      await expect(change(item.id, target.id, crypto.randomUUID())).rejects.toBeDefined();
      expect((await db.enrollment.findUniqueOrThrow({ where: { id: item.id } })).status).toBe(
        'ACTIVE',
      );
      expect(await db.enrollment.count({ where: { studentId: item.studentId } })).toBe(1);
    });
    it('serializa dos cambios simultáneos: uno solo se confirma', async () => {
      const item = await activeEnrollment();
      const [first, second] = [await academicClass(), await academicClass()];
      const results = await Promise.allSettled([
        change(item.id, first.id),
        change(item.id, second.id),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((r) => r.status === 'rejected')).toMatchObject({
        reason: { code: 'ENROLLMENT_ALREADY_ENDED' },
      });
      expect(
        await db.enrollment.count({ where: { studentId: item.studentId, status: 'ACTIVE' } }),
      ).toBe(1);
      expect(await db.auditLog.count({ where: { entityId: item.id } })).toBe(1);
    });
    it('audita el cambio de fecha de inicio', async () => {
      const item = await activeEnrollment();
      await expect(service.updateStartDate(item.id, '2026-07-20', actorId)).resolves.toMatchObject({
        startDate: '2026-07-20',
      });
      const logs = await db.auditLog.findMany({ where: { entityId: item.id } });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: 'UPDATE',
        actorUserId: actorId,
        before: { startDate: '2026-08-01' },
        after: { startDate: '2026-07-20' },
      });
    });
  },
  integrationTestTimeoutMs,
);
