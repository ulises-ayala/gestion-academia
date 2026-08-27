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

  it('quick-search devuelve alumno sin clases válidas', async () => {
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
    const result = await repository.quickSearch('Ana', attendanceDate);
    expect(result).toHaveLength(1);
    expect(result[0]?.enrollments).toEqual([]);
  });

  it('quick-search devuelve lista vacía cuando no hay alumnos coincidentes', async () => {
    const repository = new PrismaAttendanceRepository({
      student: { findMany: vi.fn(async () => []) },
    } as unknown as PrismaService);
    await expect(repository.quickSearch('Inexistente', attendanceDate)).resolves.toEqual([]);
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

    const result = await repository.quickSearch('40.123.456', monday);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ dni: { contains: '40123456' } }]),
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
});
