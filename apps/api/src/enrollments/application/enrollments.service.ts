import type { CreateEnrollmentDto, EndEnrollmentDto } from '@academy/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { parseEnrollmentDate, validateEndDate } from '../domain/enrollment';
import {
  ENROLLMENT_REPOSITORY,
  type EnrollmentQuery,
  type EnrollmentRepository,
} from './enrollment.repository';

@Injectable()
export class EnrollmentsService {
  constructor(@Inject(ENROLLMENT_REPOSITORY) private readonly repository: EnrollmentRepository) {}
  list(query: EnrollmentQuery) {
    return this.repository.findPage(query);
  }
  async get(id: string) {
    const enrollment = await this.repository.findById(id);
    if (!enrollment) throw new DomainError('ENROLLMENT_NOT_FOUND', 'Inscripción no encontrada');
    return enrollment;
  }
  create(input: CreateEnrollmentDto) {
    return this.repository.create({
      studentId: input.studentId,
      classId: input.classId,
      startDate: parseEnrollmentDate(input.startDate, 'startDate'),
    });
  }

  async createHistorical(input: {
  studentId: string;
  classId: string;
  startDate: string;
  endDate?: string | null;
    }) {
      const startDate = parseEnrollmentDate(
        input.startDate,
        'startDate',
      );

      const endDate = input.endDate
        ? validateEndDate(
            startDate,
            input.endDate,
          )
        : null;

      return this.repository.createHistorical({
        studentId: input.studentId,
        classId: input.classId,
        startDate,
        endDate,
      });
    }

async updateStartDate(
  id: string,
  startDateValue: string,
) {
  const enrollment = await this.get(id);

  const startDate = parseEnrollmentDate(
    startDateValue,
    'startDate',
  );

  if (
    enrollment.endDate &&
    startDate >
      new Date(
        `${enrollment.endDate}T00:00:00.000Z`,
      )
  ) {
    throw new DomainError(
      'INVALID_ENROLLMENT_DATE',
      'La fecha de inicio no puede ser posterior a la fecha de finalización.',
      {
        field: 'startDate',
      },
    );
  }

  return this.repository.updateStartDate(
      id,
      startDate,
    );
}
  async end(id: string, input: EndEnrollmentDto, actorId?: string) {
    const enrollment = await this.get(id);
    if (enrollment.status === 'ENDED')
      throw new DomainError('ENROLLMENT_ALREADY_ENDED', 'La inscripción ya está finalizada');
    return this.repository.end(
      id,
      validateEndDate(new Date(`${enrollment.startDate}T00:00:00.000Z`), input.endDate),
      actorId,
    );
  }
  assertStudentCanDeactivate(studentId: string) {
    return this.assertNoActiveStudentEnrollments(studentId);
  }
  assertClassCanDeactivate(classId: string) {
    return this.assertNoActiveClassEnrollments(classId);
  }
  private async assertNoActiveStudentEnrollments(id: string) {
    if (await this.repository.hasActiveForStudent(id))
      throw new DomainError(
        'STUDENT_HAS_ACTIVE_ENROLLMENTS',
        'El alumno tiene inscripciones activas. Finalizalas antes de desactivarlo.',
      );
  }
  private async assertNoActiveClassEnrollments(id: string) {
    if (await this.repository.hasActiveForClass(id))
      throw new DomainError(
        'CLASS_HAS_ACTIVE_ENROLLMENTS',
        'La clase tiene alumnos inscriptos. Finalizá las inscripciones antes de desactivarla.',
      );
  }
}
