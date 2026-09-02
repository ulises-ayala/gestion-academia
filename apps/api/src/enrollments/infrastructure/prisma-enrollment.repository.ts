import type { EnrollmentDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import type { EnrollmentQuery, EnrollmentRepository } from '../application/enrollment.repository';
import { findEnrollmentScheduleConflict } from '../domain/enrollment-schedule-conflict';

const include = {
  student: {
    select: { id: true, dni: true, firstName: true, lastName: true, phone: true, status: true },
  },
  class: {
    include: {
      danceType: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      schedules: {
        where: { status: 'ACTIVE' as const },
        include: {
          room: { select: { id: true, name: true, branch: { select: { id: true, name: true } } } },
        },
        orderBy: [{ dayOfWeek: 'asc' as const }, { startTime: 'asc' as const }],
      },
    },
  },
};
type Included = Prisma.EnrollmentGetPayload<{ include: typeof include }>;
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const time = (date: Date) => date.toISOString().slice(11, 16);
const map = (item: Included): EnrollmentDto => ({
  id: item.id,
  studentId: item.studentId,
  classId: item.classId,
  startDate: isoDate(item.startDate),
  endDate: item.endDate ? isoDate(item.endDate) : null,
  status: item.status,
  student: item.student,
  academicClass: {
    id: item.class.id,
    name: item.class.name,
    level: item.class.level,
    capacity: item.class.capacity,
    status: item.class.status,
    danceType: item.class.danceType,
    teacher: item.class.teacher,
    schedules: item.class.schedules.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: time(s.startTime),
      endTime: time(s.endTime),
      room: s.room,
    })),
    createdAt: item.class.createdAt.toISOString(),
    updatedAt: item.class.updatedAt.toISOString(),
  },
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

@Injectable()
export class PrismaEnrollmentRepository implements EnrollmentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async findById(id: string) {
    const item = await this.prisma.enrollment.findUnique({ where: { id }, include });
    return item ? map(item) : null;
  }
  async findPage(query: EnrollmentQuery) {
    const where = {
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where,
        include,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    return { items: items.map(map), total, page: query.page, pageSize: query.pageSize };
  }
  async create(input: {
    studentId: string;
    classId: string;
    startDate: Date;
  }): Promise<EnrollmentDto> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const lockKeys = [input.classId, `student:${input.studentId}`].sort();
            for (const lockKey of lockKeys)
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
            const student = await tx.student.findUnique({
              where: { id: input.studentId },
              select: { status: true },
            });
            if (!student) throw new DomainError('STUDENT_NOT_FOUND', 'Alumno no encontrado');
            if (student.status !== 'ACTIVE')
              throw new DomainError(
                'STUDENT_INACTIVE',
                'No se puede inscribir un alumno inactivo.',
              );
            const academicClass = await tx.academyClass.findUnique({
              where: { id: input.classId },
              select: {
                status: true,
                capacity: true,
                schedules: {
                  where: { status: 'ACTIVE' },
                  select: { dayOfWeek: true, startTime: true, endTime: true },
                },
              },
            });
            if (!academicClass) throw new DomainError('CLASS_NOT_FOUND', 'Clase no encontrada');
            if (academicClass.status !== 'ACTIVE')
              throw new DomainError(
                'CLASS_INACTIVE',
                'No se puede inscribir un alumno en una clase inactiva.',
              );
            if (
              await tx.enrollment.findFirst({
                where: { studentId: input.studentId, classId: input.classId, status: 'ACTIVE' },
              })
            )
              throw new DomainError(
                'ENROLLMENT_ALREADY_ACTIVE',
                'El alumno ya tiene una inscripción activa en esta clase.',
              );
            const potentiallyConcurrentEnrollments = await tx.enrollment.findMany({
              where: {
                studentId: input.studentId,
                status: 'ACTIVE',
                OR: [{ endDate: null }, { endDate: { gte: input.startDate } }],
              },
              select: {
                class: {
                  select: {
                    id: true,
                    name: true,
                    schedules: {
                      where: { status: 'ACTIVE' },
                      select: { dayOfWeek: true, startTime: true, endTime: true },
                    },
                  },
                },
              },
            });
            const conflict = findEnrollmentScheduleConflict(
              academicClass.schedules.map((schedule) => ({
                dayOfWeek: schedule.dayOfWeek,
                startTime: time(schedule.startTime),
                endTime: time(schedule.endTime),
              })),
              potentiallyConcurrentEnrollments.map((enrollment) => ({
                classId: enrollment.class.id,
                className: enrollment.class.name,
                schedules: enrollment.class.schedules.map((schedule) => ({
                  dayOfWeek: schedule.dayOfWeek,
                  startTime: time(schedule.startTime),
                  endTime: time(schedule.endTime),
                })),
              })),
            );
            if (conflict)
              throw new DomainError(
                'ENROLLMENT_SCHEDULE_CONFLICT',
                `El alumno ya está inscripto en ${conflict.className}, que se superpone con este horario.`,
                conflict,
              );
            const activeCount = await tx.enrollment.count({
              where: { classId: input.classId, status: 'ACTIVE' },
            });
            if (activeCount >= academicClass.capacity)
              throw new DomainError('CLASS_FULL', 'La clase alcanzó su cupo máximo.');
            return map(await tx.enrollment.create({ data: input, include }));
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          throw new DomainError(
            'ENROLLMENT_ALREADY_ACTIVE',
            'El alumno ya tiene una inscripción activa en esta clase.',
          );
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        )
          continue;
        throw error;
      }
    }
    throw new DomainError(
      'ENROLLMENT_CONCURRENCY_CONFLICT',
      'No se pudo confirmar la inscripción. Intentá nuevamente.',
    );
  }
    async createHistorical(input: {
      studentId: string;
      classId: string;
      startDate: Date;
      endDate: Date | null;
    }): Promise<EnrollmentDto> {
      /*
      * Importación histórica:
      * no aplicamos validaciones operativas actuales
      * como cupo, horarios o estado ACTIVE.
      */

      const student = await this.prisma.student.findUnique({
        where: { id: input.studentId },
        select: { id: true },
      });

      if (!student) {
        throw new DomainError(
          'STUDENT_NOT_FOUND',
          'Alumno no encontrado',
        );
      }

      const academicClass =
        await this.prisma.academyClass.findUnique({
          where: { id: input.classId },
          select: { id: true },
        });

      if (!academicClass) {
        throw new DomainError(
          'CLASS_NOT_FOUND',
          'Clase no encontrada',
        );
      }

      /*
      * Idempotencia:
      * si la inscripción histórica exacta ya existe,
      * no la volvemos a crear.
      */
      const existing =
        await this.prisma.enrollment.findFirst({
          where: {
            studentId: input.studentId,
            classId: input.classId,
            startDate: input.startDate,
            status: 'ENDED',
          },
          include,
        });

      if (existing) {
        return map(existing);
      }

      return map(
        await this.prisma.enrollment.create({
          data: {
            studentId: input.studentId,
            classId: input.classId,
            startDate: input.startDate,
            endDate: input.endDate,
            status: 'ENDED',
          },
          include,
        }),
      );
    }

    async updateStartDate(
      id: string,
      startDate: Date,
    ): Promise<EnrollmentDto> {
      return map(
        await this.prisma.enrollment.update({
          where: { id },
          data: { startDate },
          include,
        }),
      );
    }

  async end(id: string, endDate: Date, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.enrollment.findUniqueOrThrow({ where: { id } });
      const updated = await tx.enrollment.update({
        where: { id },
        data: { status: 'ENDED', endDate },
        include,
      });
      if (actorId)
        await tx.auditLog.create({
          data: {
            actorUserId: actorId,
            action: 'END',
            entityType: 'ENROLLMENT',
            entityId: id,
            before: {
              status: before.status,
              endDate: before.endDate?.toISOString().slice(0, 10) ?? null,
            },
            after: {
              status: updated.status,
              endDate: updated.endDate?.toISOString().slice(0, 10) ?? null,
            },
          },
        });
      return map(updated);
    });
  }
  async hasActiveForStudent(studentId: string) {
    return (await this.prisma.enrollment.count({ where: { studentId, status: 'ACTIVE' } })) > 0;
  }
  async hasActiveForClass(classId: string) {
    return (await this.prisma.enrollment.count({ where: { classId, status: 'ACTIVE' } })) > 0;
  }
}
