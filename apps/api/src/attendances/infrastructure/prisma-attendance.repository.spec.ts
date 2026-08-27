import { Prisma } from '@academy/database';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import { PrismaAttendanceRepository } from './prisma-attendance.repository';

const attendanceDate = new Date('2026-08-15T00:00:00.000Z');
const attendance = {
  id: crypto.randomUUID(),
  enrollmentId: crypto.randomUUID(),
  attendanceDate,
  status: 'PRESENT' as const,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PrismaAttendanceRepository', () => {
  it('traduce la carrera de unicidad P2002 a conflicto de dominio', async () => {
    const prisma = {
      studentAttendance: {
        create: vi.fn(async () => {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint', {
            code: 'P2002',
            clientVersion: '6.14.0',
          });
        }),
      },
    } as unknown as PrismaService;
    const repository = new PrismaAttendanceRepository(prisma);
    await expect(
      repository.create({
        enrollmentId: attendance.enrollmentId,
        attendanceDate,
        status: 'PRESENT',
        notes: null,
      }),
    ).rejects.toMatchObject({ code: 'ATTENDANCE_ALREADY_EXISTS' } satisfies Partial<DomainError>);
  });

  it('construye el roster por vigencia y adjunta la asistencia existente', async () => {
    const findMany = vi.fn(async () => [
      {
        id: attendance.enrollmentId,
        student: { id: crypto.randomUUID(), dni: '12345678', firstName: 'Ana', lastName: 'Paz' },
        attendances: [attendance],
      },
      {
        id: crypto.randomUUID(),
        student: { id: crypto.randomUUID(), dni: '23456789', firstName: 'Luis', lastName: 'Sol' },
        attendances: [],
      },
    ]);
    const repository = new PrismaAttendanceRepository({
      enrollment: { findMany },
    } as unknown as PrismaService);

    const result = await repository.roster(crypto.randomUUID(), attendanceDate);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startDate: { lte: attendanceDate },
          OR: [{ endDate: null }, { endDate: { gte: attendanceDate } }],
        }),
      }),
    );
    expect(result[0]?.attendance?.id).toBe(attendance.id);
    expect(result[1]?.attendance).toBeNull();
  });

  it('quick-search ampliado conserva al alumno aunque no tenga clases del día', async () => {
    const findMany = vi.fn(async () => [
      {
        id: crypto.randomUUID(),
        dni: '40123456',
        firstName: 'Ana',
        lastName: 'Paz',
        enrollments: [],
      },
    ]);
    const repository = new PrismaAttendanceRepository({
      student: { findMany },
    } as unknown as PrismaService);
    const result = await repository.quickSearch('Ana', attendanceDate, true);
    expect(result).toHaveLength(1);
    expect(result[0]?.enrollments).toEqual([]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
    );
  });

  it('quick-search devuelve lista vacía cuando no hay alumnos coincidentes', async () => {
    const repository = new PrismaAttendanceRepository({
      student: { findMany: vi.fn(async () => []) },
    } as unknown as PrismaService);
    await expect(repository.quickSearch('Inexistente', attendanceDate, false)).resolves.toEqual([]);
  });

  it('quick-search filtra por vigencia, devuelve detalles y prioriza horarios del día', async () => {
    const monday = new Date('2026-08-17T00:00:00.000Z');
    const schedule = (dayOfWeek: 'MONDAY' | 'THURSDAY', hour: number) => ({
      id: crypto.randomUUID(),
      dayOfWeek,
      startTime: new Date(Date.UTC(1970, 0, 1, hour)),
      endTime: new Date(Date.UTC(1970, 0, 1, hour + 1)),
      room: { name: 'Salón 1' },
    });
    const enrollment = (
      className: string,
      dayOfWeek: 'MONDAY' | 'THURSDAY',
      existingAttendance: typeof attendance | undefined,
    ) => ({
      id: crypto.randomUUID(),
      class: {
        id: crypto.randomUUID(),
        name: className,
        teacher: { id: crypto.randomUUID(), firstName: 'Luz', lastName: 'Gómez' },
        schedules: [schedule(dayOfWeek, 20)],
      },
      attendances: existingAttendance ? [existingAttendance] : [],
    });
    const findMany = vi.fn(async () => [
      {
        id: crypto.randomUUID(),
        dni: '40123456',
        firstName: 'Ana',
        lastName: 'Paz',
        enrollments: [
          enrollment('Salsa', 'THURSDAY', undefined),
          enrollment('Bachata', 'MONDAY', attendance),
        ],
      },
    ]);
    const repository = new PrismaAttendanceRepository({
      student: { findMany },
    } as unknown as PrismaService);

    const result = await repository.quickSearch('40.123.456', monday, false);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([{ dni: { contains: '40123456' } }]),
            }),
            expect.objectContaining({
              enrollments: expect.objectContaining({
                some: expect.objectContaining({
                  class: {
                    schedules: { some: { status: 'ACTIVE', dayOfWeek: 'MONDAY' } },
                  },
                }),
              }),
            }),
          ]),
        }),
        select: expect.objectContaining({
          enrollments: expect.objectContaining({
            where: {
              startDate: { lte: monday },
              OR: [{ endDate: null }, { endDate: { gte: monday } }],
            },
          }),
        }),
      }),
    );
    expect(result[0]?.enrollments.map((item) => item.className)).toEqual(['Bachata', 'Salsa']);
    expect(result[0]?.enrollments[0]).toMatchObject({
      scheduledOnSelectedDay: true,
      teacher: { firstName: 'Luz', lastName: 'Gómez' },
      attendance: { id: attendance.id },
      schedules: [{ dayOfWeek: 'MONDAY', startTime: '20:00', endTime: '21:00' }],
    });
    expect(result[0]?.enrollments[1]?.scheduledOnSelectedDay).toBe(false);
  });

  it('devuelve las clases del weekday ordenadas y cuenta vigencia histórica', async () => {
    const monday = new Date('2026-08-17T00:00:00.000Z');
    const findMany = vi.fn(async () => [
      {
        id: crypto.randomUUID(),
        name: 'Bachata',
        danceType: { name: 'Bachata' },
        teacher: { id: crypto.randomUUID(), firstName: 'Luz', lastName: 'Gómez' },
        schedules: [
          {
            startTime: new Date('1970-01-01T20:00:00.000Z'),
            endTime: new Date('1970-01-01T21:00:00.000Z'),
            room: {
              id: crypto.randomUUID(),
              name: 'Rojo',
              branch: { id: crypto.randomUUID(), name: 'Centro' },
            },
          },
          {
            startTime: new Date('1970-01-01T18:00:00.000Z'),
            endTime: new Date('1970-01-01T19:00:00.000Z'),
            room: {
              id: crypto.randomUUID(),
              name: 'Azul',
              branch: { id: crypto.randomUUID(), name: 'Centro' },
            },
          },
        ],
        enrollments: [{ attendances: [attendance] }, { attendances: [] }],
      },
    ]);
    const repository = new PrismaAttendanceRepository({
      academyClass: { findMany },
    } as unknown as PrismaService);

    const result = await repository.dayClasses(monday);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schedules: { some: { status: 'ACTIVE', dayOfWeek: 'MONDAY' } },
        }),
        select: expect.objectContaining({
          enrollments: expect.objectContaining({
            where: {
              startDate: { lte: monday },
              OR: [{ endDate: null }, { endDate: { gte: monday } }],
            },
          }),
        }),
      }),
    );
    expect(result.map((item) => item.startTime)).toEqual(['18:00', '20:00']);
    expect(result[0]).toMatchObject({ enrolledCount: 2, presentCount: 1 });
  });

  it('guarda el roster con upsert dentro de una transacción', async () => {
    const classId = crypto.randomUUID();
    const firstEnrollmentId = crypto.randomUUID();
    const secondEnrollmentId = crypto.randomUUID();
    const thirdEnrollmentId = crypto.randomUUID();
    const findMany = vi.fn(async () => [
      { id: firstEnrollmentId },
      { id: secondEnrollmentId },
      { id: thirdEnrollmentId },
    ]);
    const upsert = vi.fn(async ({ create }) => ({
      ...attendance,
      id: crypto.randomUUID(),
      enrollmentId: create.enrollmentId,
      status: create.status,
    }));
    const transaction = { enrollment: { findMany }, studentAttendance: { upsert } };
    const repository = new PrismaAttendanceRepository({
      $transaction: vi.fn(async (operation) => operation(transaction)),
    } as unknown as PrismaService);

    const result = await repository.saveRoster(classId, attendanceDate, [
      { enrollmentId: firstEnrollmentId, status: 'PRESENT', notes: null },
      { enrollmentId: secondEnrollmentId, status: 'JUSTIFIED', notes: 'Avisó' },
      { enrollmentId: thirdEnrollmentId, status: 'ABSENT', notes: null },
    ]);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ classId, startDate: { lte: attendanceDate } }),
      }),
    );
    expect(upsert).toHaveBeenCalledTimes(3);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { status: 'PRESENT', notes: null } }),
    );
    expect(result.map((item) => item.status)).toEqual(['PRESENT', 'JUSTIFIED', 'ABSENT']);
  });

  it('rechaza atómicamente una inscripción de otra clase o fuera de vigencia', async () => {
    const upsert = vi.fn();
    const transaction = {
      enrollment: { findMany: vi.fn(async () => []) },
      studentAttendance: { upsert },
    };
    const repository = new PrismaAttendanceRepository({
      $transaction: vi.fn(async (operation) => operation(transaction)),
    } as unknown as PrismaService);

    await expect(
      repository.saveRoster(crypto.randomUUID(), attendanceDate, [
        { enrollmentId: crypto.randomUUID(), status: 'ABSENT', notes: null },
      ]),
    ).rejects.toMatchObject({
      code: 'ATTENDANCE_OUTSIDE_ENROLLMENT_PERIOD',
    } satisfies Partial<DomainError>);
    expect(upsert).not.toHaveBeenCalled();
  });
});
