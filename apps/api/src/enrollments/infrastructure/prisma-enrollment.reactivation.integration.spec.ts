import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { prismaTransactionOptions } from '../../database/prisma-transaction-options';
import { integrationDatabaseEnabled } from '../../database/integration-database';
import { EnrollmentsService } from '../application/enrollments.service';
import { PrismaEnrollmentRepository } from './prisma-enrollment.repository';

// Explicit opt-in; never load a developer's .env or run fixtures on the academy database.
describe.runIf(integrationDatabaseEnabled)('Enrollment reactivation on PostgreSQL', () => {
  const db = new PrismaClient({ transactionOptions: prismaTransactionOptions });
  const service = new EnrollmentsService(new PrismaEnrollmentRepository(db as PrismaService));
  const token = crypto.randomUUID();
  let teacherId: string;
  let danceTypeId: string;
  let roomId: string;
  let actorId: string;
  beforeAll(async () => {
    teacherId = (
      await db.teacher.create({
        data: { dni: token.slice(0, 30), firstName: 'Luz', lastName: 'Docente' },
      })
    ).id;
    danceTypeId = (await db.danceType.create({ data: { name: token, normalizedName: token } })).id;
    const branch = await db.branch.create({ data: { name: token, address: 'Calle 1' } });
    roomId = (await db.room.create({ data: { name: token, capacity: 30, branchId: branch.id } }))
      .id;
    actorId = (
      await db.adminUser.create({
        data: { username: token, passwordHash: 'test-only', role: 'MANAGER' },
      })
    ).id;
  });
  afterAll(async () => db.$disconnect());
  const student = () =>
    db.student.create({
      data: {
        firstName: 'Laura',
        lastName: `Pérez ${token}`,
        dni: BigInt(`0x${crypto.randomUUID().replaceAll('-', '')}`)
          .toString()
          .slice(0, 32),
      },
    });
  // Con horario: el caso reportado chocaba contra los horarios de la misma clase.
  const cardio = () =>
    db.academyClass.create({
      data: {
        name: `Cardiolatin ${crypto.randomUUID()}`,
        teacherId,
        danceTypeId,
        capacity: 30,
        schedules: {
          create: {
            dayOfWeek: 'TUESDAY',
            startTime: new Date('1970-01-01T18:00:00.000Z'),
            endTime: new Date('1970-01-01T19:00:00.000Z'),
            roomId,
          },
        },
      },
    });
  const endedEnrollment = async (endDate: string | null) => {
    const owner = await student();
    const academicClass = await cardio();
    return db.enrollment.create({
      data: {
        studentId: owner.id,
        classId: academicClass.id,
        startDate: new Date('2026-08-01'),
        status: 'ENDED',
        endDate: endDate ? new Date(endDate) : null,
        endReason: 'NON_PAYMENT',
      },
    });
  };

  it('reinscribir en la misma clase dentro del período explica el período, no el horario', async () => {
    const ended = await endedEnrollment('2026-10-30');
    await expect(
      service.create({
        studentId: ended.studentId,
        classId: ended.classId,
        startDate: '2026-10-30',
      }),
    ).rejects.toMatchObject({
      code: 'ENROLLMENT_PERIOD_OVERLAP',
      details: { enrollmentId: ended.id, nextStartDate: '2026-10-31' },
    });
    await expect(
      service.create({
        studentId: ended.studentId,
        classId: ended.classId,
        startDate: '2026-10-31',
      }),
    ).resolves.toMatchObject({ status: 'ACTIVE' });
  });

  it('reactiva la inscripción finalizada y audita el fin anterior', async () => {
    const ended = await endedEnrollment('2026-10-30');
    await expect(service.reactivate(ended.id, actorId)).resolves.toMatchObject({
      id: ended.id,
      status: 'ACTIVE',
      endDate: null,
      endReason: null,
    });
    await expect(
      db.auditLog.findFirst({ where: { entityId: ended.id, action: 'REACTIVATE' } }),
    ).resolves.toMatchObject({
      actorUserId: actorId,
      before: { status: 'ENDED', endDate: '2026-10-30', endReason: 'NON_PAYMENT' },
      after: { status: 'ACTIVE', endDate: null },
    });
    await expect(service.reactivate(ended.id, actorId)).rejects.toMatchObject({
      code: 'ENROLLMENT_NOT_ENDED',
    });
  });

  it('reactiva una inscripción legacy finalizada sin fecha de fin', async () => {
    const ended = await endedEnrollment(null);
    await expect(service.reactivate(ended.id, actorId)).resolves.toMatchObject({
      status: 'ACTIVE',
    });
  });

  it('no reactiva una inscripción si hay otra posterior a la misma clase', async () => {
    const earlier = await endedEnrollment('2026-09-15');
    await db.enrollment.create({
      data: {
        studentId: earlier.studentId,
        classId: earlier.classId,
        startDate: new Date('2026-10-01'),
        status: 'ENDED',
        endDate: new Date('2026-10-20'),
        endReason: 'NON_PAYMENT',
      },
    });
    await expect(service.reactivate(earlier.id, actorId)).rejects.toMatchObject({
      code: 'ENROLLMENT_REACTIVATION_SUPERSEDED',
    });
    await expect(db.enrollment.findUnique({ where: { id: earlier.id } })).resolves.toMatchObject({
      status: 'ENDED',
    });
  });
});
