import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ATTENDANCE_REPOSITORY,
  type AttendancePersistenceInput,
  type AttendanceRepository,
    type AttendanceUpdateInput,
    type AttendanceListFilters,
} from './attendance.repository';

import {
  ENROLLMENT_REPOSITORY,
  type EnrollmentRepository,
} from '../../enrollments/application/enrollment.repository';

@Injectable()
export class AttendancesService {
  constructor(
    @Inject(ATTENDANCE_REPOSITORY)
    private readonly attendanceRepository: AttendanceRepository,

    @Inject(ENROLLMENT_REPOSITORY)
    private readonly enrollmentRepository: EnrollmentRepository,
  ) {}

async create(
  input: AttendancePersistenceInput,
) {
  const enrollment =
    await this.enrollmentRepository.findById(
      input.enrollmentId,
    );

  if (!enrollment) {
    throw new NotFoundException(
      'Enrollment not found',
    );
  }

  const existingAttendance =
    await this.attendanceRepository.findByEnrollmentAndDate(
      input.enrollmentId,
      input.attendanceDate,
    );

  if (existingAttendance) {
    throw new ConflictException(
      'Attendance already exists for this enrollment and date',
    );
  }

  return this.attendanceRepository.create(input);
}
  async findById(id: string) {
    const attendance =
      await this.attendanceRepository.findById(id);

    if (!attendance) {
      throw new NotFoundException('Attendance not found');
    }

    return attendance;
  }

async update(
  id: string,
  input: AttendanceUpdateInput,
) {
  const attendance =
    await this.attendanceRepository.findById(id);

  if (!attendance) {
    throw new NotFoundException('Attendance not found');
  }

  return this.attendanceRepository.update(id, input);
}

async list(filters: AttendanceListFilters) {
  return this.attendanceRepository.list(filters);
}
}