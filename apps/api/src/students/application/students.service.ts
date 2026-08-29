import { Inject, Injectable, Optional } from '@nestjs/common';
import { EnrollmentsService } from '../../enrollments/application/enrollments.service';
import { DomainError } from '../../shared/domain/domain-error';
import { validateStudentInput, type StudentData, type StudentInput } from '../domain/student';
import {
  STUDENT_REPOSITORY,
  type StudentListQuery,
  type StudentPage,
  type StudentRepository,
} from './student.repository';

@Injectable()
export class StudentsService {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly repository: StudentRepository,
    @Optional() private readonly enrollments?: EnrollmentsService,
  ) {}

  list(query: StudentListQuery): Promise<StudentPage> {
    return this.repository.findPage(query);
  }

  async get(id: string): Promise<StudentData> {
    const student = await this.repository.findById(id);
    if (!student) throw new DomainError('STUDENT_NOT_FOUND', 'Alumno no encontrado');
    return student;
  }

  async create(input: StudentInput): Promise<StudentData> {
    const data = validateStudentInput(input);
    if (await this.repository.findByDni(data.dni)) {
      throw new DomainError('DNI_ALREADY_EXISTS', 'Ya existe un alumno con ese DNI', {
        field: 'dni',
      });
    }
    return this.repository.create(data);
  }

  async update(id: string, patch: Partial<StudentInput>, actorId?: string): Promise<StudentData> {
    const current = await this.get(id);
    const input: StudentInput = {
      dni: patch.dni ?? current.dni,
      firstName: patch.firstName ?? current.firstName,
      lastName: patch.lastName ?? current.lastName,
      birthDate:
        patch.birthDate === undefined
          ? (current.birthDate?.toISOString().slice(0, 10) ?? null)
          : patch.birthDate,
      phone: patch.phone === undefined ? current.phone : patch.phone,
      email: patch.email === undefined ? current.email : patch.email,
      address: patch.address === undefined ? current.address : patch.address,
      status: patch.status ?? current.status,
    };
    const data = validateStudentInput(input);
    const duplicate = await this.repository.findByDni(data.dni);
    if (duplicate && duplicate.id !== id) {
      throw new DomainError('DNI_ALREADY_EXISTS', 'Ya existe un alumno con ese DNI', {
        field: 'dni',
      });
    }
    return this.repository.update(id, data, actorId);
  }

  async deactivate(id: string, actorId?: string): Promise<StudentData> {
    await this.get(id);
    await this.enrollments?.assertStudentCanDeactivate(id);
    return this.update(id, { status: 'INACTIVE' }, actorId);
  }

  async reactivate(id: string, actorId?: string): Promise<StudentData> {
    return this.update(id, { status: 'ACTIVE' }, actorId);
  }
}
