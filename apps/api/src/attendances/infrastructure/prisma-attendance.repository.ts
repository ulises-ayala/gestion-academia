import { Inject, Injectable } from '@nestjs/common';

import type { StudentAttendance } from '@academy/database';

import { PrismaService } from '../../database/prisma.service';

import type {
  AttendanceListFilters,  
  AttendancePersistenceInput,
  AttendanceRepository,
  AttendanceUpdateInput,
} from '../application/attendance.repository';

import type { AttendanceData } from '../domain/attendance';

const toDomain = (
  attendance: StudentAttendance,
): AttendanceData => ({
  id: attendance.id,
  enrollmentId: attendance.enrollmentId,
  attendanceDate: attendance.attendanceDate,
  status: attendance.status,
  notes: attendance.notes,
  createdAt: attendance.createdAt,
  updatedAt: attendance.updatedAt,
});

@Injectable()
export class PrismaAttendanceRepository
  implements AttendanceRepository
{
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async create(
    input: AttendancePersistenceInput,
  ): Promise<AttendanceData> {
    const attendance =
      await this.prisma.studentAttendance.create({
        data: input,
      });

    return toDomain(attendance);
  }

  async findById(
    id: string,
  ): Promise<AttendanceData | null> {
    const attendance =
      await this.prisma.studentAttendance.findUnique({
        where: { id },
      });

    return attendance ? toDomain(attendance) : null;
  }

  async findByEnrollmentAndDate(
    enrollmentId: string,
    attendanceDate: Date,
  ): Promise<AttendanceData | null> {
    const attendance =
      await this.prisma.studentAttendance.findUnique({
        where: {
          enrollmentId_attendanceDate: {
            enrollmentId,
            attendanceDate,
          },
        },
      });

    return attendance ? toDomain(attendance) : null;
  }

async update(
  id: string,
  input: AttendanceUpdateInput,
): Promise<AttendanceData> {
  const attendance =
    await this.prisma.studentAttendance.update({
      where: { id },
      data: input,
    });

  return toDomain(attendance);
}

async list(
  filters: AttendanceListFilters,
): Promise<readonly AttendanceData[]> {
  const attendances =
    await this.prisma.studentAttendance.findMany({
      where: {
        ...(filters.attendanceDate
          ? { attendanceDate: filters.attendanceDate }
          : {}),
        ...(filters.classId
          ? {
              enrollment: {
                classId: filters.classId,
              },
            }
          : {}),
      },
      orderBy: {
        attendanceDate: 'desc',
      },
    });

  return attendances.map(toDomain);
}
}