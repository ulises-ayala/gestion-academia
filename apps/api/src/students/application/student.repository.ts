import type { StudentData } from '../domain/student';

export const STUDENT_REPOSITORY = Symbol('STUDENT_REPOSITORY');

export type StudentPersistenceInput = Omit<StudentData, 'id' | 'joinedAt' | 'createdAt' | 'updatedAt'>;

export interface StudentRepository {
  create(input: StudentPersistenceInput): Promise<StudentData>;
  findAll(status?: 'ACTIVE' | 'INACTIVE'): Promise<StudentData[]>;
  findById(id: string): Promise<StudentData | null>;
  findByDni(dni: string): Promise<StudentData | null>;
  update(id: string, input: StudentPersistenceInput): Promise<StudentData>;
}
