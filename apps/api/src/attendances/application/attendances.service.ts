import type {
  CreateAttendanceDto,
  SaveAttendanceRosterDto,
  UpdateAttendanceDto,
} from '@academy/contracts';
import { Inject, Injectable } from '@nestjs/common';
import {
  ENROLLMENT_REPOSITORY,
  type EnrollmentRepository,
} from '../../enrollments/application/enrollment.repository';
import { DomainError } from '../../shared/domain/domain-error';
import {
  ATTENDANCE_REPOSITORY,
  type AttendanceListFilters,
  type AttendanceRepository,
} from './attendance.repository';
import {
  attendanceAlreadyExists,
  attendanceDayOfWeek,
  normalizeAttendanceNotes,
  parseAttendanceDate,
  parseAttendanceStatus,
  resolveAttendanceSchedule,
} from '../domain/attendance';

@Injectable()
export class AttendancesService {
  constructor(
    @Inject(ATTENDANCE_REPOSITORY)
    private readonly attendanceRepository: AttendanceRepository,
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly enrollmentRepository: EnrollmentRepository,
  ) {}

  async create(input: CreateAttendanceDto) {
    const attendanceDate = parseAttendanceDate(input.attendanceDate);
    const enrollment = await this.enrollmentRepository.findById(input.enrollmentId);
    if (!enrollment)
      throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada', {
        field: 'enrollmentId',
      });
    if (
      input.attendanceDate < enrollment.startDate ||
      (enrollment.endDate !== null && input.attendanceDate > enrollment.endDate)
    )
      throw new DomainError(
        'ATTENDANCE_OUTSIDE_ENROLLMENT_PERIOD',
        'La fecha de asistencia está fuera de la vigencia de la inscripción',
        { field: 'attendanceDate' },
      );
    const scheduleId = await this.scheduleFor(enrollment.classId, attendanceDate, input.scheduleId);
    if (await this.attendanceRepository.findSlot(input.enrollmentId, attendanceDate, scheduleId))
      throw attendanceAlreadyExists(scheduleId);
    return this.attendanceRepository.create({
      enrollmentId: input.enrollmentId,
      attendanceDate,
      scheduleId,
      status: parseAttendanceStatus(input.status),
      notes: normalizeAttendanceNotes(input.notes) ?? null,
    });
  }

  async findById(id: string) {
    const attendance = await this.attendanceRepository.findById(id);
    if (!attendance) throw new DomainError('ATTENDANCE_NOT_FOUND', 'Asistencia no encontrada');
    return attendance;
  }

  async update(id: string, input: UpdateAttendanceDto, actorId?: string) {
    await this.findById(id);
    if (input.status === undefined && input.notes === undefined)
      throw new DomainError('VALIDATION_ERROR', 'Debe indicar status o notes para modificar', {
        field: 'body',
      });
    const patch = {
      ...(input.status !== undefined ? { status: parseAttendanceStatus(input.status) } : {}),
      ...(input.notes !== undefined
        ? { notes: normalizeAttendanceNotes(input.notes) ?? null }
        : {}),
    };
    return actorId
      ? this.attendanceRepository.update(id, patch, actorId)
      : this.attendanceRepository.update(id, patch);
  }

  list(filters: AttendanceListFilters) {
    return this.attendanceRepository.list(filters);
  }

  async roster(classId: string, attendanceDate: Date, requestedScheduleId?: string | null) {
    const scheduleId = await this.scheduleFor(classId, attendanceDate, requestedScheduleId);
    return {
      scheduleId,
      items: await this.attendanceRepository.roster(classId, attendanceDate, scheduleId),
    };
  }

  dayClasses(attendanceDate: Date) {
    return this.attendanceRepository.dayClasses(attendanceDate);
  }

  quickSearch(query: string, attendanceDate: Date, includeOtherDays = false) {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length > 100)
      throw new DomainError('VALIDATION_ERROR', 'La búsqueda no puede superar 100 caracteres', {
        field: 'q',
      });
    if (!normalizedQuery) return [];
    return this.attendanceRepository.quickSearch(normalizedQuery, attendanceDate, includeOtherDays);
  }

  async saveRoster(input: SaveAttendanceRosterDto, attendanceDate: Date) {
    const enrollmentIds = input.attendances.map((item) => item.enrollmentId);
    if (new Set(enrollmentIds).size !== enrollmentIds.length)
      throw new DomainError('VALIDATION_ERROR', 'No puede repetir una inscripción en la lista', {
        field: 'attendances',
      });
    const scheduleId = await this.scheduleFor(input.classId, attendanceDate, input.scheduleId);
    const items = await this.attendanceRepository.saveRoster(
      input.classId,
      attendanceDate,
      scheduleId,
      input.attendances.map((item) => ({
        enrollmentId: item.enrollmentId,
        status: parseAttendanceStatus(item.status),
        notes: normalizeAttendanceNotes(item.notes) ?? null,
      })),
    );
    return { scheduleId, items };
  }

  private async scheduleFor(
    classId: string,
    attendanceDate: Date,
    requested: string | null | undefined,
  ) {
    return resolveAttendanceSchedule(
      await this.attendanceRepository.classDaySchedules(
        classId,
        attendanceDayOfWeek(attendanceDate),
      ),
      requested,
    );
  }
}
