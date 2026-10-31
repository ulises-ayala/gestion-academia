import type { EnrollmentDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  SERIALIZABLE_TRANSACTION_ATTEMPTS,
  isSerializationConflict,
  waitBeforeSerializableRetry,
} from '../../database/serializable-retry';
import { DomainError } from '../../shared/domain/domain-error';
import type {
  EnrollmentClassChangeData,
  EnrollmentQuery,
  EnrollmentRepository,
  EnrollmentEndData,
} from '../application/enrollment.repository';
import {
  classChangeEndDate,
  nextDay,
  samePeriodEnrollmentError,
  validateEndDate,
  validateEndReason,
} from '../domain/enrollment';
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
  endReason: item.endReason,
  endNote: item.endNote,
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
    return this.serializable(async (tx) => {
      const lockKeys = [input.classId, `student:${input.studentId}`].sort();
      for (const lockKey of lockKeys)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      return this.createWithin(tx, input);
    });
  }
  async changeClass(id: string, data: EnrollmentClassChangeData, actorId?: string) {
    return this.serializable(async (tx) => {
      const current = await tx.enrollment.findUnique({ where: { id } });
      if (!current) throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada.');
      const lockKeys = [current.classId, data.classId, `student:${current.studentId}`].sort();
      for (const lockKey of lockKeys)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      await tx.$queryRaw`SELECT id FROM enrollments WHERE id = ${id}::uuid FOR UPDATE`;
      const before = await tx.enrollment.findUnique({ where: { id } });
      if (!before) throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada.');
      if (before.status !== 'ACTIVE')
        throw new DomainError('ENROLLMENT_ALREADY_ENDED', 'La inscripción ya está finalizada.');
      const endDate = classChangeEndDate(before, data);
      const reason = validateEndReason(data.endReason, data.endNote);
      const ended = await tx.enrollment.update({
        where: { id },
        data: { status: 'ENDED', endDate, ...reason },
        include,
      });
      const created = await this.createWithin(tx, {
        studentId: before.studentId,
        classId: data.classId,
        startDate: data.startDate,
      });
      if (actorId)
        await tx.auditLog.create({
          data: {
            actorUserId: actorId,
            action: 'CLASS_CHANGE',
            entityType: 'ENROLLMENT',
            entityId: id,
            before: { classId: before.classId, status: before.status, endDate: null },
            after: {
              classId: created.classId,
              status: ended.status,
              endDate: isoDate(endDate),
              endReason: ended.endReason,
              endNote: ended.endNote,
            },
            metadata: {
              studentId: before.studentId,
              studentName: `${ended.student.firstName} ${ended.student.lastName}`,
              fromClassName: ended.class.name,
              toClassName: created.academicClass.name,
              newEnrollmentId: created.id,
            },
          },
        });
      return { ended: map(ended), created };
    });
  }
  async reactivate(id: string, actorId?: string) {
    return this.serializable(async (tx) => {
      const current = await tx.enrollment.findUnique({ where: { id } });
      if (!current) throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada.');
      const lockKeys = [current.classId, `student:${current.studentId}`].sort();
      for (const lockKey of lockKeys)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      await tx.$queryRaw`SELECT id FROM enrollments WHERE id = ${id}::uuid FOR UPDATE`;
      const before = await tx.enrollment.findUnique({ where: { id } });
      if (!before) throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada.');
      if (before.status !== 'ENDED')
        throw new DomainError('ENROLLMENT_NOT_ENDED', 'La inscripción ya está activa.');
      // Vuelve a ocupar el lugar desde el día siguiente a su fin (o desde su inicio si no tiene).
      await this.assertCanOccupy(tx, {
        studentId: before.studentId,
        classId: before.classId,
        from: before.endDate ? nextDay(before.endDate) : before.startDate,
        reactivatingId: id,
      });
      const updated = await tx.enrollment.update({
        where: { id },
        data: { status: 'ACTIVE', endDate: null, endReason: null, endNote: null },
        include,
      });
      if (actorId)
        await tx.auditLog.create({
          data: {
            actorUserId: actorId,
            action: 'REACTIVATE',
            entityType: 'ENROLLMENT',
            entityId: id,
            before: {
              status: before.status,
              endDate: before.endDate ? isoDate(before.endDate) : null,
              endReason: before.endReason,
              endNote: before.endNote,
            },
            after: { status: updated.status, endDate: null, endReason: null, endNote: null },
            metadata: {
              studentId: before.studentId,
              studentName: `${updated.student.firstName} ${updated.student.lastName}`,
              classId: before.classId,
              className: updated.class.name,
            },
          },
        });
      return map(updated);
    });
  }
  private async createWithin(
    tx: Prisma.TransactionClient,
    input: { studentId: string; classId: string; startDate: Date },
  ): Promise<EnrollmentDto> {
    await this.assertCanOccupy(tx, {
      studentId: input.studentId,
      classId: input.classId,
      from: input.startDate,
    });
    return map(await tx.enrollment.create({ data: input, include }));
  }
  /**
   * Valida que el alumno pueda ocupar un lugar en la clase desde `from`, sin fecha de fin: alta
   * nueva o reactivación (`reactivatingId`, que se excluye de las comparaciones).
   */
  private async assertCanOccupy(
    tx: Prisma.TransactionClient,
    input: { studentId: string; classId: string; from: Date; reactivatingId?: string },
  ) {
    const student = await tx.student.findUnique({
      where: { id: input.studentId },
      select: { status: true },
    });
    if (!student) throw new DomainError('STUDENT_NOT_FOUND', 'Alumno no encontrado');
    if (student.status !== 'ACTIVE')
      throw new DomainError('STUDENT_INACTIVE', 'No se puede inscribir un alumno inactivo.');
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
    const coexisting: Prisma.EnrollmentWhereInput[] = [
      { endDate: null },
      { endDate: { gte: input.from } },
    ];
    const samePeriod = await tx.enrollment.findFirst({
      where: {
        studentId: input.studentId,
        classId: input.classId,
        ...(input.reactivatingId ? { id: { not: input.reactivatingId } } : {}),
        OR: coexisting,
      },
      select: { id: true, startDate: true, endDate: true },
      orderBy: { startDate: 'desc' },
    });
    if (samePeriod) throw samePeriodEnrollmentError(samePeriod, Boolean(input.reactivatingId));
    // La misma clase ya se resolvió arriba: sus horarios coinciden consigo mismos.
    const potentiallyConcurrentEnrollments = await tx.enrollment.findMany({
      where: {
        studentId: input.studentId,
        classId: { not: input.classId },
        OR: coexisting,
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
  }
  private async serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < SERIALIZABLE_TRANSACTION_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          throw new DomainError(
            'ENROLLMENT_ALREADY_ACTIVE',
            'El alumno ya tiene una inscripción activa en esta clase.',
          );
        if (isSerializationConflict(error)) {
          if (attempt < SERIALIZABLE_TRANSACTION_ATTEMPTS - 1) {
            await waitBeforeSerializableRetry(attempt);
            continue;
          }
          throw new DomainError(
            'ENROLLMENT_CONCURRENCY_CONFLICT',
            'No se pudo confirmar la inscripción. Intentá nuevamente.',
          );
        }
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
    const student = await this.prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true },
    });
    if (!student) throw new DomainError('STUDENT_NOT_FOUND', 'Alumno no encontrado');
    const academicClass = await this.prisma.academyClass.findUnique({
      where: { id: input.classId },
      select: { id: true },
    });
    if (!academicClass) throw new DomainError('CLASS_NOT_FOUND', 'Clase no encontrada');
    const existing = await this.prisma.enrollment.findFirst({
      where: {
        studentId: input.studentId,
        classId: input.classId,
        startDate: input.startDate,
        status: 'ENDED',
      },
      include,
    });
    if (existing) return map(existing);
    return map(
      await this.prisma.enrollment.create({
        data: { ...input, status: 'ENDED' },
        include,
      }),
    );
  }
  async updateStartDate(id: string, startDate: Date, actorId?: string): Promise<EnrollmentDto> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM enrollments WHERE id = ${id}::uuid FOR UPDATE`;
      const before = await tx.enrollment.findUnique({ where: { id } });
      if (!before) throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada.');
      const updated = await tx.enrollment.update({ where: { id }, data: { startDate }, include });
      if (actorId)
        await tx.auditLog.create({
          data: {
            actorUserId: actorId,
            action: 'UPDATE',
            entityType: 'ENROLLMENT',
            entityId: id,
            before: { startDate: isoDate(before.startDate) },
            after: { startDate: isoDate(updated.startDate) },
            metadata: {
              studentId: before.studentId,
              studentName: `${updated.student.firstName} ${updated.student.lastName}`,
              classId: before.classId,
              className: updated.class.name,
            },
          },
        });
      return map(updated);
    });
  }
  async end(id: string, data: EnrollmentEndData, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM enrollments WHERE id = ${id}::uuid FOR UPDATE`;
      const before = await tx.enrollment.findUnique({ where: { id } });
      if (!before) throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada.');
      if (before.status !== 'ACTIVE')
        throw new DomainError('ENROLLMENT_ALREADY_ENDED', 'La inscripción ya está finalizada.');
      const endDate = validateEndDate(before.startDate, isoDate(data.endDate));
      const reason = validateEndReason(data.endReason, data.endNote);
      const updated = await tx.enrollment.update({
        where: { id },
        data: { status: 'ENDED', endDate, ...reason },
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
              endReason: before.endReason,
              endNote: before.endNote,
            },
            after: {
              status: updated.status,
              endDate: updated.endDate?.toISOString().slice(0, 10) ?? null,
              endReason: updated.endReason,
              endNote: updated.endNote,
            },
            metadata: {
              studentId: before.studentId,
              studentName: `${updated.student.firstName} ${updated.student.lastName}`,
              classId: before.classId,
              className: updated.class.name,
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
