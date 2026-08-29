import type { EnrollmentDto, EnrollmentStatusDto } from '@academy/contracts';

export const ENROLLMENT_REPOSITORY = Symbol('ENROLLMENT_REPOSITORY');
export type EnrollmentQuery = Readonly<{
  studentId?: string;
  classId?: string;
  status?: EnrollmentStatusDto;
  page: number;
  pageSize: number;
}>;

export interface EnrollmentRepository {
  findById(id: string): Promise<EnrollmentDto | null>;
  findPage(
    query: EnrollmentQuery,
  ): Promise<{ items: EnrollmentDto[]; total: number; page: number; pageSize: number }>;
  create(input: { studentId: string; classId: string; startDate: Date }): Promise<EnrollmentDto>;
  end(id: string, endDate: Date, actorId?: string): Promise<EnrollmentDto>;
  hasActiveForStudent(studentId: string): Promise<boolean>;
  hasActiveForClass(classId: string): Promise<boolean>;
}
