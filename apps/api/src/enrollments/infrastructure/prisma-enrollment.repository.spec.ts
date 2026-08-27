import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import { PrismaEnrollmentRepository } from './prisma-enrollment.repository';

const atTime = (value: string) => new Date(`1970-01-01T${value}:00.000Z`);

describe('PrismaEnrollmentRepository schedule conflicts', () => {
  it('bloquea por clase y alumno y rechaza una inscripción temporalmente coexistente', async () => {
    const studentId = crypto.randomUUID();
    const classId = crypto.randomUUID();
    const conflictingClassId = crypto.randomUUID();
    const executeRaw = vi.fn(async () => 1);
    const findMany = vi.fn(async () => [
      {
        class: {
          id: conflictingClassId,
          name: 'Bachata Inicial',
          schedules: [
            {
              dayOfWeek: 'TUESDAY',
              startTime: atTime('18:00'),
              endTime: atTime('19:00'),
            },
          ],
        },
      },
    ]);
    const transaction = {
      $executeRaw: executeRaw,
      student: { findUnique: vi.fn(async () => ({ status: 'ACTIVE' })) },
      academyClass: {
        findUnique: vi.fn(async () => ({
          status: 'ACTIVE',
          capacity: 20,
          schedules: [
            {
              dayOfWeek: 'TUESDAY',
              startTime: atTime('18:30'),
              endTime: atTime('19:30'),
            },
          ],
        })),
      },
      enrollment: {
        findFirst: vi.fn(async () => null),
        findMany,
        count: vi.fn(async () => 0),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (operation) => operation(transaction)),
    } as unknown as PrismaService;

    await expect(
      new PrismaEnrollmentRepository(prisma).create({
        studentId,
        classId,
        startDate: new Date('2026-06-15T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'ENROLLMENT_SCHEDULE_CONFLICT',
      details: {
        classId: conflictingClassId,
        className: 'Bachata Inicial',
        dayOfWeek: 'TUESDAY',
        startTime: '18:00',
        endTime: '19:00',
      },
    } satisfies Partial<DomainError>);
    expect(executeRaw).toHaveBeenCalledTimes(2);
    const expectedLockKeys = [classId, `student:${studentId}`].sort();
    expect(executeRaw).toHaveBeenNthCalledWith(1, expect.any(Array), expectedLockKeys[0]);
    expect(executeRaw).toHaveBeenNthCalledWith(2, expect.any(Array), expectedLockKeys[1]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId,
          OR: [{ endDate: null }, { endDate: { gte: new Date('2026-06-15T00:00:00.000Z') } }],
        },
      }),
    );
    expect(transaction.enrollment.create).not.toHaveBeenCalled();
  });

  it('permite horarios contiguos y conserva el control de capacidad', async () => {
    const studentId = crypto.randomUUID();
    const classId = crypto.randomUUID();
    const startDate = new Date('2026-07-01T00:00:00.000Z');
    const targetSchedule = {
      id: crypto.randomUUID(),
      dayOfWeek: 'TUESDAY' as const,
      startTime: atTime('19:00'),
      endTime: atTime('20:00'),
      status: 'ACTIVE' as const,
      roomId: crypto.randomUUID(),
      classId,
      createdAt: new Date(),
      updatedAt: new Date(),
      room: {
        id: crypto.randomUUID(),
        name: 'Rojo',
        branch: { id: crypto.randomUUID(), name: 'Centro' },
      },
    };
    const created = {
      id: crypto.randomUUID(),
      studentId,
      classId,
      startDate,
      endDate: null,
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      student: {
        id: studentId,
        dni: '40111222',
        firstName: 'Ana',
        lastName: 'Paz',
        phone: null,
        status: 'ACTIVE' as const,
      },
      class: {
        id: classId,
        name: 'Salsa Inicial',
        level: 'Inicial',
        capacity: 20,
        status: 'ACTIVE' as const,
        danceTypeId: crypto.randomUUID(),
        teacherId: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        danceType: { id: crypto.randomUUID(), name: 'Salsa' },
        teacher: { id: crypto.randomUUID(), firstName: 'Luz', lastName: 'Gómez' },
        schedules: [targetSchedule],
      },
    };
    const create = vi.fn(async () => created);
    const count = vi.fn(async () => 19);
    const transaction = {
      $executeRaw: vi.fn(async () => 1),
      student: { findUnique: vi.fn(async () => ({ status: 'ACTIVE' })) },
      academyClass: {
        findUnique: vi.fn(async () => ({
          status: 'ACTIVE',
          capacity: 20,
          schedules: [targetSchedule],
        })),
      },
      enrollment: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => [
          {
            class: {
              id: crypto.randomUUID(),
              name: 'Bachata',
              schedules: [
                {
                  dayOfWeek: 'TUESDAY',
                  startTime: atTime('18:00'),
                  endTime: atTime('19:00'),
                },
              ],
            },
          },
        ]),
        count,
        create,
      },
    };
    const prisma = {
      $transaction: vi.fn(async (operation) => operation(transaction)),
    } as unknown as PrismaService;

    await expect(
      new PrismaEnrollmentRepository(prisma).create({ studentId, classId, startDate }),
    ).resolves.toMatchObject({ id: created.id, classId });
    expect(count).toHaveBeenCalledWith({ where: { classId, status: 'ACTIVE' } });
    expect(create).toHaveBeenCalledOnce();
  });
});
