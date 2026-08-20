import type { StudentData } from '../domain/student';

export const STUDENT_REPOSITORY = Symbol('STUDENT_REPOSITORY');

export type StudentPersistenceInput = Omit<
  StudentData,
  'id' | 'joinedAt' | 'createdAt' | 'updatedAt'
>;
export type StudentListQuery = Readonly<{
  q?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  page: number;
  pageSize: number;
}>;
export type StudentPage = Readonly<{
  items: StudentData[];
  total: number;
  page: number;
  pageSize: number;
}>;

export interface StudentRepository {
  create(input: StudentPersistenceInput): Promise<StudentData>;
  findPage(query: StudentListQuery): Promise<StudentPage>;
  findById(id: string): Promise<StudentData | null>;
  findByDni(dni: string): Promise<StudentData | null>;
  update(id: string, input: StudentPersistenceInput): Promise<StudentData>;
}
