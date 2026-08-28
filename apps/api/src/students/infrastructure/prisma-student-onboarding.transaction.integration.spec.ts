import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { StudentOnboardingService } from '../application/student-onboarding.service';
import { PrismaStudentOnboardingTransaction } from './prisma-student-onboarding.transaction';

const enabled = Boolean(process.env.DATABASE_URL);
describe.runIf(enabled)('Student onboarding atomicity and concurrency', () => {
  const prisma = new PrismaClient();
  const service = new StudentOnboardingService(
    new PrismaStudentOnboardingTransaction(prisma as PrismaService),
  );

  const fixture = async () => {
    const token = crypto.randomUUID();
    return prisma.$transaction(async (tx) => {
      const teacher = await tx.teacher.create({
        data: {
          dni: `8${token.replaceAll('-', '').slice(0, 31)}`,
          firstName: 'Docente',
          lastName: 'Onboarding',
        },
      });
      const danceType = await tx.danceType.create({
        data: { name: `Onboarding ${token}`, normalizedName: `onboarding-${token}` },
      });
      const availableClass = await tx.academyClass.create({
        data: {
          name: `Último cupo ${token}`,
          danceTypeId: danceType.id,
          teacherId: teacher.id,
          capacity: 1,
        },
      });
      const fullClass = await tx.academyClass.create({
        data: {
          name: `Completa ${token}`,
          danceTypeId: danceType.id,
          teacherId: teacher.id,
          capacity: 1,
        },
      });
      const tariff = await tx.tariff.create({
        data: {
          name: `Tarifa ${token}`,
          amount: '40000.00',
          validFrom: new Date('2026-08-01T00:00:00Z'),
        },
      });
      const filler = await tx.student.create({
        data: {
          dni: `7${token.replaceAll('-', '').slice(0, 31)}`,
          firstName: 'Cupo',
          lastName: 'Completo',
          joinedAt: new Date('2026-08-01T00:00:00Z'),
        },
      });
      await tx.enrollment.create({
        data: {
          studentId: filler.id,
          classId: fullClass.id,
          startDate: new Date('2026-08-01T00:00:00Z'),
        },
      });
      return { token, teacher, danceType, availableClass, fullClass, tariff, filler };
    });
  };

  const cleanup = async (data: Awaited<ReturnType<typeof fixture>>) => {
    const classIds = [data.availableClass.id, data.fullClass.id];
    await prisma.$transaction(async (tx) => {
      const enrollmentIds = (
        await tx.enrollment.findMany({ where: { classId: { in: classIds } }, select: { id: true } })
      ).map(({ id }) => id);
      await tx.monthlyCharge.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
      await tx.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } });
      await tx.student.deleteMany({
        where: { OR: [{ id: data.filler.id }, { lastName: data.token }] },
      });
      await tx.academyClass.deleteMany({ where: { id: { in: classIds } } });
      await tx.tariff.delete({ where: { id: data.tariff.id } });
      await tx.danceType.delete({ where: { id: data.danceType.id } });
      await tx.teacher.delete({ where: { id: data.teacher.id } });
    });
  };

  const input = (
    data: Awaited<ReturnType<typeof fixture>>,
    suffix: string,
    classIds: readonly string[],
  ) => ({
    student: {
      dni: `${suffix}${String(
        [...data.token].reduce((sum, character) => sum + character.charCodeAt(0), 0),
      )
        .padStart(7, '0')
        .slice(-7)}`,
      firstName: 'Alta',
      lastName: data.token,
    },
    enrollments: classIds.map((classId) => ({ classId, tariffId: data.tariff.id })),
    period: '2026-08',
    dueDate: '2026-08-10',
  });

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  it('revierte alumno, inscripción y cuota si una segunda clase no tiene cupo', async () => {
    const data = await fixture();
    try {
      await expect(
        service.create(
          input(data, '6', [data.availableClass.id, data.fullClass.id]),
          crypto.randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'CLASS_FULL' });
      expect(await prisma.student.count({ where: { lastName: data.token } })).toBe(0);
      expect(await prisma.enrollment.count({ where: { classId: data.availableClass.id } })).toBe(0);
      expect(
        await prisma.monthlyCharge.count({
          where: { enrollment: { classId: data.availableClass.id } },
        }),
      ).toBe(0);
    } finally {
      await cleanup(data);
    }
  });

  it('permite un solo onboarding para el último cupo y no deja alumno parcial', async () => {
    const data = await fixture();
    try {
      const results = await Promise.allSettled([
        service.create(input(data, '5', [data.availableClass.id]), crypto.randomUUID()),
        service.create(input(data, '4', [data.availableClass.id]), crypto.randomUUID()),
      ]);
      expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
      expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
      expect(await prisma.enrollment.count({ where: { classId: data.availableClass.id } })).toBe(1);
      expect(await prisma.student.count({ where: { lastName: data.token } })).toBe(1);
    } finally {
      await cleanup(data);
    }
  });

  it('revierte alumno e inscripción si falla la creación de la cuota', async () => {
    const data = await fixture();
    try {
      const invalidTariffId = crypto.randomUUID();
      const request = input(data, '3', [data.availableClass.id]);
      await expect(
        service.create(
          {
            ...request,
            enrollments: [{ classId: data.availableClass.id, tariffId: invalidTariffId }],
          },
          crypto.randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'TARIFF_NOT_FOUND' });
      expect(await prisma.student.count({ where: { lastName: data.token } })).toBe(0);
      expect(await prisma.enrollment.count({ where: { classId: data.availableClass.id } })).toBe(0);
      expect(
        await prisma.monthlyCharge.count({
          where: { enrollment: { classId: data.availableClass.id } },
        }),
      ).toBe(0);
    } finally {
      await cleanup(data);
    }
  });

  it('revierte alumno, inscripción y cuota si falla el pago', async () => {
    const data = await fixture();
    try {
      await expect(
        service.create(
          { ...input(data, '2', [data.availableClass.id]), payment: { paymentMethod: 'CASH' } },
          crypto.randomUUID(),
        ),
      ).rejects.toBeTruthy();
      expect(await prisma.student.count({ where: { lastName: data.token } })).toBe(0);
      expect(await prisma.enrollment.count({ where: { classId: data.availableClass.id } })).toBe(0);
      expect(
        await prisma.monthlyCharge.count({
          where: { enrollment: { classId: data.availableClass.id } },
        }),
      ).toBe(0);
      expect(await prisma.payment.count({ where: { student: { lastName: data.token } } })).toBe(0);
    } finally {
      await cleanup(data);
    }
  });
});
