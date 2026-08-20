import { beforeEach, describe, expect, it } from 'vitest';
import { DomainError } from '../../shared/domain/domain-error';
import type { StudentData } from '../domain/student';
import type { StudentPersistenceInput, StudentRepository } from './student.repository';
import { StudentsService } from './students.service';

class MemoryStudentRepository implements StudentRepository {
  students: StudentData[] = [];

  async create(input: StudentPersistenceInput): Promise<StudentData> {
    const now = new Date();
    const student = { ...input, id: crypto.randomUUID(), joinedAt: now, createdAt: now, updatedAt: now };
    this.students.push(student);
    return student;
  }
  async findAll(status?: 'ACTIVE' | 'INACTIVE') { return this.students.filter((item) => !status || item.status === status); }
  async findById(id: string) { return this.students.find((item) => item.id === id) ?? null; }
  async findByDni(dni: string) { return this.students.find((item) => item.dni === dni) ?? null; }
  async update(id: string, input: StudentPersistenceInput) {
    const index = this.students.findIndex((item) => item.id === id);
    const current = this.students[index];
    if (!current) throw new Error('missing test student');
    const updated = { ...current, ...input, updatedAt: new Date() };
    this.students[index] = updated;
    return updated;
  }
}

describe('StudentsService', () => {
  let repository: MemoryStudentRepository;
  let service: StudentsService;

  beforeEach(() => {
    repository = new MemoryStudentRepository();
    service = new StudentsService(repository);
  });

  it('crea y recupera un alumno', async () => {
    const created = await service.create({ dni: '12.345.678', firstName: 'Ana', lastName: 'Pérez' });
    await expect(service.get(created.id)).resolves.toEqual(created);
    expect(created.dni).toBe('12345678');
  });

  it('impide DNI duplicado aun con distinto formato', async () => {
    await service.create({ dni: '12.345.678', firstName: 'Ana', lastName: 'Pérez' });
    await expect(service.create({ dni: '12345678', firstName: 'Juan', lastName: 'Gómez' }))
      .rejects.toMatchObject({ code: 'DNI_ALREADY_EXISTS' } satisfies Partial<DomainError>);
  });

  it('desactiva sin borrar el alumno', async () => {
    const created = await service.create({ dni: '12345678', firstName: 'Ana', lastName: 'Pérez' });
    await expect(service.deactivate(created.id)).resolves.toMatchObject({ status: 'INACTIVE' });
    await expect(service.get(created.id)).resolves.toMatchObject({ id: created.id });
  });
});
