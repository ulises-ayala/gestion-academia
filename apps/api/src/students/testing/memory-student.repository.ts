import type { StudentData } from '../domain/student';
import type {
  StudentListQuery,
  StudentPage,
  StudentPersistenceInput,
  StudentRepository,
} from '../application/student.repository';

export class MemoryStudentRepository implements StudentRepository {
  students: StudentData[] = [];

  async create(input: StudentPersistenceInput): Promise<StudentData> {
    const now = new Date();
    const student = {
      ...input,
      id: crypto.randomUUID(),
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.students.push(student);
    return student;
  }

  async findPage(query: StudentListQuery): Promise<StudentPage> {
    const q = query.q?.trim().toLocaleLowerCase('es');
    const digits = q && /^[\d.\-\s()+]+$/.test(q) ? q.replace(/\D/g, '') : '';
    const terms = q?.split(/\s+/).filter(Boolean) ?? [];
    const filtered = this.students.filter((student) => {
      if (query.status && student.status !== query.status) return false;
      if (!q) return true;
      const firstName = student.firstName.toLocaleLowerCase('es');
      const lastName = student.lastName.toLocaleLowerCase('es');
      return (
        firstName.includes(q) ||
        lastName.includes(q) ||
        student.phone?.toLocaleLowerCase('es').includes(q) === true ||
        (digits.length > 0 && student.dni.includes(digits)) ||
        terms.every((term) => firstName.includes(term) || lastName.includes(term))
      );
    });
    const start = (query.page - 1) * query.pageSize;
    return {
      items: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(id: string) {
    return this.students.find((student) => student.id === id) ?? null;
  }
  async findByDni(dni: string) {
    return this.students.find((student) => student.dni === dni) ?? null;
  }
  async update(id: string, input: StudentPersistenceInput) {
    const index = this.students.findIndex((student) => student.id === id);
    const current = this.students[index];
    if (!current) throw new Error('missing test student');
    const updated = { ...current, ...input, updatedAt: new Date() };
    this.students[index] = updated;
    return updated;
  }
}
