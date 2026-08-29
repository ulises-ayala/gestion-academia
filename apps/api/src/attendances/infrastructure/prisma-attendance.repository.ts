import type { StudentAttendance } from '@academy/database';
import { Prisma } from '@academy/database';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';
import { buildStudentSearchWhere } from '../../students/infrastructure/prisma-student-search';
import type {
  AttendanceListFilters,
  AttendancePersistenceInput,
  AttendanceRepository,
  AttendanceRosterSaveItem,
  AttendanceUpdateInput,
} from '../application/attendance.repository';
import type { AttendanceData } from '../domain/attendance';

const toDomain = (attendance: StudentAttendance): AttendanceData => ({
  id: attendance.id,
  enrollmentId: attendance.enrollmentId,
  attendanceDate: attendance.attendanceDate,
  status: attendance.status,
  notes: attendance.notes,
  createdAt: attendance.createdAt,
  updatedAt: attendance.updatedAt,
});
const isoTime = (value: Date) => value.toISOString().slice(11, 16);
const weekdays = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

@Injectable()
export class PrismaAttendanceRepository implements AttendanceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: AttendancePersistenceInput) {
    try {
      return toDomain(await this.prisma.studentAttendance.create({ data: input }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new DomainError(
          'ATTENDANCE_ALREADY_EXISTS',
          'Ya existe una asistencia para esta inscripción y fecha',
        );
      throw error;
    }
  }

  async findById(id: string) {
    const attendance = await this.prisma.studentAttendance.findUnique({ where: { id } });
    return attendance ? toDomain(attendance) : null;
  }

  async findByEnrollmentAndDate(enrollmentId: string, attendanceDate: Date) {
    const attendance = await this.prisma.studentAttendance.findUnique({
      where: { enrollmentId_attendanceDate: { enrollmentId, attendanceDate } },
    });
    return attendance ? toDomain(attendance) : null;
  }

  async update(id: string, input: AttendanceUpdateInput, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.studentAttendance.findUniqueOrThrow({ where: { id } });
      const updated = await tx.studentAttendance.update({ where: { id }, data: input });
      if (actorId)
        await tx.auditLog.create({
          data: {
            actorUserId: actorId,
            action: 'CORRECTION',
            entityType: 'ATTENDANCE',
            entityId: id,
            before: { status: before.status, notes: before.notes },
            after: { status: updated.status, notes: updated.notes },
          },
        });
      return toDomain(updated);
    });
  }

  async list(filters: AttendanceListFilters) {
    const attendances = await this.prisma.studentAttendance.findMany({
      where: {
        ...(filters.attendanceDate ? { attendanceDate: filters.attendanceDate } : {}),
        ...(filters.classId || filters.studentId
          ? {
              enrollment: {
                ...(filters.classId ? { classId: filters.classId } : {}),
                ...(filters.studentId ? { studentId: filters.studentId } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'asc' }],
      ...(filters.limit ? { take: filters.limit } : {}),
    });
    return attendances.map(toDomain);
  }

  async roster(classId: string, attendanceDate: Date) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        startDate: { lte: attendanceDate },
        OR: [{ endDate: null }, { endDate: { gte: attendanceDate } }],
      },
      select: {
        id: true,
        student: { select: { id: true, dni: true, firstName: true, lastName: true } },
        attendances: { where: { attendanceDate }, take: 1 },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });
    return enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      student: enrollment.student,
      attendance: enrollment.attendances[0] ? toDomain(enrollment.attendances[0]) : null,
    }));
  }

  async dayClasses(attendanceDate: Date) {
    const selectedDay = weekdays[attendanceDate.getUTCDay()]!;
    const classes = await this.prisma.academyClass.findMany({
      where: {
        schedules: { some: { status: 'ACTIVE', dayOfWeek: selectedDay } },
      },
      select: {
        id: true,
        name: true,
        danceType: { select: { name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        schedules: {
          where: { status: 'ACTIVE', dayOfWeek: selectedDay },
          select: {
            startTime: true,
            endTime: true,
            room: {
              select: {
                id: true,
                name: true,
                branch: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { startTime: 'asc' },
        },
        enrollments: {
          where: {
            startDate: { lte: attendanceDate },
            OR: [{ endDate: null }, { endDate: { gte: attendanceDate } }],
          },
          select: {
            attendances: {
              where: { attendanceDate, status: 'PRESENT' },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    return classes
      .flatMap((academyClass) =>
        academyClass.schedules.map((schedule) => ({
          classId: academyClass.id,
          className: academyClass.name,
          danceType: academyClass.danceType.name,
          teacher: academyClass.teacher,
          room: { id: schedule.room.id, name: schedule.room.name },
          branch: schedule.room.branch,
          startTime: isoTime(schedule.startTime),
          endTime: isoTime(schedule.endTime),
          enrolledCount: academyClass.enrollments.length,
          presentCount: academyClass.enrollments.filter(
            (enrollment) => enrollment.attendances.length > 0,
          ).length,
        })),
      )
      .sort(
        (left, right) =>
          left.startTime.localeCompare(right.startTime) ||
          left.className.localeCompare(right.className, 'es'),
      );
  }

  async quickSearch(query: string, attendanceDate: Date, includeOtherDays: boolean) {
    const selectedDay = weekdays[attendanceDate.getUTCDay()]!;
    const enrollmentIsValid: Prisma.EnrollmentWhereInput = {
      startDate: { lte: attendanceDate },
      OR: [{ endDate: null }, { endDate: { gte: attendanceDate } }],
    };
    const dayEnrollmentFilter: Prisma.EnrollmentWhereInput = {
      ...enrollmentIsValid,
      class: {
        schedules: { some: { status: 'ACTIVE', dayOfWeek: selectedDay } },
      },
    };
    const studentWhere: Prisma.StudentWhereInput = includeOtherDays
      ? buildStudentSearchWhere(query)
      : {
          AND: [buildStudentSearchWhere(query), { enrollments: { some: dayEnrollmentFilter } }],
        };
    const students = await this.prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        dni: true,
        firstName: true,
        lastName: true,
        enrollments: {
          where: enrollmentIsValid,
          select: {
            id: true,
            class: {
              select: {
                id: true,
                name: true,
                teacher: { select: { id: true, firstName: true, lastName: true } },
                schedules: {
                  where: { status: 'ACTIVE' },
                  select: {
                    id: true,
                    dayOfWeek: true,
                    startTime: true,
                    endTime: true,
                    room: { select: { name: true } },
                  },
                  orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
                },
              },
            },
            attendances: { where: { attendanceDate }, take: 1 },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      take: 20,
    });

    return students.map((student) => ({
      student: {
        id: student.id,
        dni: student.dni,
        firstName: student.firstName,
        lastName: student.lastName,
      },
      enrollments: student.enrollments
        .map((enrollment) => ({
          enrollmentId: enrollment.id,
          classId: enrollment.class.id,
          className: enrollment.class.name,
          teacher: enrollment.class.teacher,
          schedules: enrollment.class.schedules.map((schedule) => ({
            id: schedule.id,
            dayOfWeek: schedule.dayOfWeek,
            startTime: isoTime(schedule.startTime),
            endTime: isoTime(schedule.endTime),
            roomName: schedule.room.name,
          })),
          scheduledOnSelectedDay: enrollment.class.schedules.some(
            (schedule) => schedule.dayOfWeek === selectedDay,
          ),
          attendance: enrollment.attendances[0] ? toDomain(enrollment.attendances[0]) : null,
        }))
        .sort(
          (left, right) =>
            Number(right.scheduledOnSelectedDay) - Number(left.scheduledOnSelectedDay) ||
            left.className.localeCompare(right.className, 'es'),
        ),
    }));
  }

  async saveRoster(
    classId: string,
    attendanceDate: Date,
    items: readonly AttendanceRosterSaveItem[],
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const enrollmentIds = items.map((item) => item.enrollmentId);
      const validEnrollments = await transaction.enrollment.findMany({
        where: {
          id: { in: enrollmentIds },
          classId,
          startDate: { lte: attendanceDate },
          OR: [{ endDate: null }, { endDate: { gte: attendanceDate } }],
        },
        select: { id: true },
      });
      if (validEnrollments.length !== enrollmentIds.length)
        throw new DomainError(
          'ATTENDANCE_OUTSIDE_ENROLLMENT_PERIOD',
          'La lista contiene una inscripción de otra clase o fuera de vigencia',
          { field: 'attendances' },
        );

      return Promise.all(
        items.map(async (item) =>
          toDomain(
            await transaction.studentAttendance.upsert({
              where: {
                enrollmentId_attendanceDate: {
                  enrollmentId: item.enrollmentId,
                  attendanceDate,
                },
              },
              create: { ...item, attendanceDate },
              update: { status: item.status, notes: item.notes },
            }),
          ),
        ),
      );
    });
  }
}
