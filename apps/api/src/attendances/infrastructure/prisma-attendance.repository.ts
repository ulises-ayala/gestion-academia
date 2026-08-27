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

  async update(id: string, input: AttendanceUpdateInput) {
    return toDomain(await this.prisma.studentAttendance.update({ where: { id }, data: input }));
  }

  async list(filters: AttendanceListFilters) {
    const attendances = await this.prisma.studentAttendance.findMany({
      where: {
        ...(filters.attendanceDate ? { attendanceDate: filters.attendanceDate } : {}),
        ...(filters.classId ? { enrollment: { classId: filters.classId } } : {}),
      },
      orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'asc' }],
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

  async quickSearch(query: string, attendanceDate: Date) {
    const selectedDay = weekdays[attendanceDate.getUTCDay()];
    const students = await this.prisma.student.findMany({
      where: buildStudentSearchWhere(query),
      select: {
        id: true,
        dni: true,
        firstName: true,
        lastName: true,
        enrollments: {
          where: {
            startDate: { lte: attendanceDate },
            OR: [{ endDate: null }, { endDate: { gte: attendanceDate } }],
          },
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
}
