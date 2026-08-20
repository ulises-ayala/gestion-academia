import type { EnrollmentDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../../shared/domain/domain-error';
import type { EnrollmentQuery, EnrollmentRepository } from './enrollment.repository';
import { EnrollmentsService } from './enrollments.service';

const studentId = crypto.randomUUID();
const classId = crypto.randomUUID();
const dto = (overrides: Partial<EnrollmentDto> = {}): EnrollmentDto => ({
  id: crypto.randomUUID(),
  studentId,
  classId,
  startDate: '2026-08-20',
  endDate: null,
  status: 'ACTIVE',
  student: {
    id: studentId,
    dni: '12345678',
    firstName: 'Ana',
    lastName: 'Pérez',
    phone: null,
    status: 'ACTIVE',
  },
  academicClass: {
    id: classId,
    name: 'Bachata',
    level: 'Inicial',
    capacity: 1,
    status: 'ACTIVE',
    danceType: { id: crypto.randomUUID(), name: 'Bachata' },
    teacher: { id: crypto.randomUUID(), firstName: 'Juan', lastName: 'Pérez' },
    schedules: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});
class MemoryEnrollments implements EnrollmentRepository {
  items: EnrollmentDto[] = [];
  students = new Map<string, string>([[studentId, 'ACTIVE']]);
  classes = new Map<string, { status: string; capacity: number }>([
    [classId, { status: 'ACTIVE', capacity: 1 }],
  ]);
  async findById(id: string) {
    return this.items.find((x) => x.id === id) ?? null;
  }
  async findPage(query: EnrollmentQuery) {
    const items = this.items.filter(
      (x) =>
        (!query.studentId || x.studentId === query.studentId) &&
        (!query.classId || x.classId === query.classId) &&
        (!query.status || x.status === query.status),
    );
    return { items, total: items.length, page: query.page, pageSize: query.pageSize };
  }
  async create(input: { studentId: string; classId: string; startDate: Date }) {
    const student = this.students.get(input.studentId);
    if (!student) throw new DomainError('STUDENT_NOT_FOUND', 'Alumno no encontrado');
    if (student !== 'ACTIVE') throw new DomainError('STUDENT_INACTIVE', 'Alumno inactivo');
    const academicClass = this.classes.get(input.classId);
    if (!academicClass) throw new DomainError('CLASS_NOT_FOUND', 'Clase no encontrada');
    if (academicClass.status !== 'ACTIVE')
      throw new DomainError('CLASS_INACTIVE', 'Clase inactiva');
    if (
      this.items.some(
        (x) =>
          x.studentId === input.studentId && x.classId === input.classId && x.status === 'ACTIVE',
      )
    )
      throw new DomainError('ENROLLMENT_ALREADY_ACTIVE', 'Duplicada');
    if (
      this.items.filter((x) => x.classId === input.classId && x.status === 'ACTIVE').length >=
      academicClass.capacity
    )
      throw new DomainError('CLASS_FULL', 'Cupo completo');
    const item = dto({
      studentId: input.studentId,
      classId: input.classId,
      startDate: input.startDate.toISOString().slice(0, 10),
    });
    this.items.push(item);
    return item;
  }
  async end(id: string, endDate: Date) {
    const current = this.items.find((x) => x.id === id)!;
    const ended = {
      ...current,
      status: 'ENDED' as const,
      endDate: endDate.toISOString().slice(0, 10),
    };
    this.items[this.items.indexOf(current)] = ended;
    return ended;
  }
  async hasActiveForStudent(id: string) {
    return this.items.some((x) => x.studentId === id && x.status === 'ACTIVE');
  }
  async hasActiveForClass(id: string) {
    return this.items.some((x) => x.classId === id && x.status === 'ACTIVE');
  }
}
describe('EnrollmentsService', () => {
  it('crea una inscripción válida y la lista para alumno/clase', async () => {
    const repo = new MemoryEnrollments();
    const service = new EnrollmentsService(repo);
    await service.create({ studentId, classId, startDate: '2026-08-20' });
    await expect(
      service.list({ studentId, classId, page: 1, pageSize: 25 }),
    ).resolves.toMatchObject({ total: 1 });
  });
  it.each([
    ['STUDENT_NOT_FOUND', 'student', undefined],
    ['STUDENT_INACTIVE', 'student', 'INACTIVE'],
    ['CLASS_NOT_FOUND', 'class', undefined],
    ['CLASS_INACTIVE', 'class', 'INACTIVE'],
  ])('rechaza %s', async (code, kind, status) => {
    const repo = new MemoryEnrollments();
    if (kind === 'student')
      status ? repo.students.set(studentId, status) : repo.students.delete(studentId);
    else status ? repo.classes.set(classId, { status, capacity: 1 }) : repo.classes.delete(classId);
    await expect(
      new EnrollmentsService(repo).create({ studentId, classId, startDate: '2026-08-20' }),
    ).rejects.toMatchObject({ code });
  });
  it('rechaza duplicado activo y permite reinscribir tras finalizar', async () => {
    const repo = new MemoryEnrollments();
    const service = new EnrollmentsService(repo);
    const first = await service.create({ studentId, classId, startDate: '2026-01-01' });
    await expect(
      service.create({ studentId, classId, startDate: '2026-02-01' }),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_ALREADY_ACTIVE' });
    await service.end(first.id, { endDate: '2026-05-01' });
    await expect(
      service.create({ studentId, classId, startDate: '2026-08-01' }),
    ).resolves.toMatchObject({ status: 'ACTIVE' });
  });
  it('finaliza preservando historia y rechaza finalizar dos veces', async () => {
    const repo = new MemoryEnrollments();
    const service = new EnrollmentsService(repo);
    const item = await service.create({ studentId, classId, startDate: '2026-01-01' });
    await expect(service.end(item.id, { endDate: '2026-05-01' })).resolves.toMatchObject({
      status: 'ENDED',
      endDate: '2026-05-01',
    });
    await expect(service.end(item.id, { endDate: '2026-06-01' })).rejects.toMatchObject({
      code: 'ENROLLMENT_ALREADY_ENDED',
    });
  });
  it('rechaza endDate anterior a startDate', async () => {
    const repo = new MemoryEnrollments();
    const service = new EnrollmentsService(repo);
    const item = await service.create({ studentId, classId, startDate: '2026-08-20' });
    await expect(service.end(item.id, { endDate: '2026-08-19' })).rejects.toMatchObject({
      code: 'END_DATE_BEFORE_START_DATE',
    });
  });
  it('acepta mientras hay cupo y rechaza clase llena', async () => {
    const repo = new MemoryEnrollments();
    const service = new EnrollmentsService(repo);
    await service.create({ studentId, classId, startDate: '2026-08-20' });
    const other = crypto.randomUUID();
    repo.students.set(other, 'ACTIVE');
    await expect(
      service.create({ studentId: other, classId, startDate: '2026-08-20' }),
    ).rejects.toMatchObject({ code: 'CLASS_FULL' });
  });
  it('bloquea desactivar alumno y clase con inscripciones activas', async () => {
    const repo = new MemoryEnrollments();
    const service = new EnrollmentsService(repo);
    await service.create({ studentId, classId, startDate: '2026-08-20' });
    await expect(service.assertStudentCanDeactivate(studentId)).rejects.toMatchObject({
      code: 'STUDENT_HAS_ACTIVE_ENROLLMENTS',
    });
    await expect(service.assertClassCanDeactivate(classId)).rejects.toMatchObject({
      code: 'CLASS_HAS_ACTIVE_ENROLLMENTS',
    });
  });
});
