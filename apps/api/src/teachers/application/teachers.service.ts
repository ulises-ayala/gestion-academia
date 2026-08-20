import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { validateTeacher, type TeacherInput } from '../domain/teacher';
import { TEACHER_REPOSITORY, type TeacherQuery, type TeacherRepository } from './teacher.repository';

@Injectable()
export class TeachersService {
  constructor(@Inject(TEACHER_REPOSITORY) private readonly repository: TeacherRepository) {}
  list(query: TeacherQuery) { return this.repository.findPage(query); }
  async get(id: string) { const teacher = await this.repository.findById(id); if (!teacher) throw new DomainError('TEACHER_NOT_FOUND', 'Profesor no encontrado'); return teacher; }
  async create(input: TeacherInput) { const data = validateTeacher(input); if (await this.repository.findByDni(data.dni)) throw new DomainError('DNI_ALREADY_EXISTS', 'Ya existe un profesor con ese DNI', { field: 'dni' }); return this.repository.create(data); }
  async update(id: string, patch: Partial<TeacherInput>) {
    const current = await this.get(id);
    if (patch.status === 'INACTIVE' && current.status === 'ACTIVE' && await this.repository.hasActiveClasses(id)) throw new DomainError('TEACHER_IN_USE', 'No se puede desactivar un profesor asignado a clases activas');
    const data = validateTeacher({ dni: patch.dni ?? current.dni, firstName: patch.firstName ?? current.firstName, lastName: patch.lastName ?? current.lastName, phone: patch.phone === undefined ? current.phone : patch.phone, email: patch.email === undefined ? current.email : patch.email, address: patch.address === undefined ? current.address : patch.address, status: patch.status ?? current.status });
    const duplicate = await this.repository.findByDni(data.dni); if (duplicate && duplicate.id !== id) throw new DomainError('DNI_ALREADY_EXISTS', 'Ya existe un profesor con ese DNI', { field: 'dni' });
    return this.repository.update(id, data);
  }
  deactivate(id: string) { return this.update(id, { status: 'INACTIVE' }); }
  reactivate(id: string) { return this.update(id, { status: 'ACTIVE' }); }
}
