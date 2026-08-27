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
  normalizeAttendanceNotes,
  parseAttendanceDate,
  parseAttendanceStatus,
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
    if (await this.attendanceRepository.findByEnrollmentAndDate(input.enrollmentId, attendanceDate))
      throw new DomainError(
        'ATTENDANCE_ALREADY_EXISTS',
        'Ya existe una asistencia para esta inscripción y fecha',
      );
    return this.attendanceRepository.create({
      enrollmentId: input.enrollmentId,
      attendanceDate,
      status: parseAttendanceStatus(input.status),
      notes: normalizeAttendanceNotes(input.notes) ?? null,
    });
  }

  async findById(id: string) {
    const attendance = await this.attendanceRepository.findById(id);
    if (!attendance) throw new DomainError('ATTENDANCE_NOT_FOUND', 'Asistencia no encontrada');
    return attendance;
  }

  async update(id: string, input: UpdateAttendanceDto) {
    await this.findById(id);
    if (input.status === undefined && input.notes === undefined)
      throw new DomainError('VALIDATION_ERROR', 'Debe indicar status o notes para modificar', {
        field: 'body',
      });
    return this.attendanceRepository.update(id, {
      ...(input.status !== undefined ? { status: parseAttendanceStatus(input.status) } : {}),
      ...(input.notes !== undefined
        ? { notes: normalizeAttendanceNotes(input.notes) ?? null }
        : {}),
    });
  }

  list(filters: AttendanceListFilters) {
    return this.attendanceRepository.list(filters);
  }

  roster(classId: string, attendanceDate: Date) {
    return this.attendanceRepository.roster(classId, attendanceDate);
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

  saveRoster(input: SaveAttendanceRosterDto, attendanceDate: Date) {
    const enrollmentIds = input.attendances.map((item) => item.enrollmentId);
    if (new Set(enrollmentIds).size !== enrollmentIds.length)
      throw new DomainError('VALIDATION_ERROR', 'No puede repetir una inscripción en la lista', {
        field: 'attendances',
      });
    return this.attendanceRepository.saveRoster(
      input.classId,
      attendanceDate,
      input.attendances.map((item) => ({
        enrollmentId: item.enrollmentId,
        status: parseAttendanceStatus(item.status),
        notes: normalizeAttendanceNotes(item.notes) ?? null,
      })),
    );
  }
}
