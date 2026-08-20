import type { EnrollmentDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import type { EnrollmentQuery, EnrollmentRepository } from '../application/enrollment.repository';

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
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.classId}))`;
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
              select: { status: true, capacity: true },
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
  async end(id: string, endDate: Date) {
    return map(
      await this.prisma.enrollment.update({
        where: { id },
        data: { status: 'ENDED', endDate },
        include,
      }),
    );
  }
  async hasActiveForStudent(studentId: string) {
    return (await this.prisma.enrollment.count({ where: { studentId, status: 'ACTIVE' } })) > 0;
  }
  async hasActiveForClass(classId: string) {
    return (await this.prisma.enrollment.count({ where: { classId, status: 'ACTIVE' } })) > 0;
  }
}
