import type {
  EnrollmentDto,
  EnrollmentStatusDto,
  EnrollmentEndReasonDto,
} from '@academy/contracts';

export type EnrollmentEndData = Readonly<{
  endDate: Date;
  endReason: EnrollmentEndReasonDto;
  endNote: string | null;
}>;

export type EnrollmentClassChangeData = Readonly<
  Omit<EnrollmentEndData, 'endDate'> & { classId: string; startDate: Date }
>;

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
  createHistorical(input: {
    studentId: string;
    classId: string;
    startDate: Date;
    endDate: Date | null;
  }): Promise<EnrollmentDto>;
  updateStartDate(id: string, startDate: Date, actorId?: string): Promise<EnrollmentDto>;
  end(id: string, data: EnrollmentEndData, actorId?: string): Promise<EnrollmentDto>;
  /** Finaliza la inscripción el día previo a `startDate` e inscribe en `classId` desde esa fecha. */
  changeClass(
    id: string,
    data: EnrollmentClassChangeData,
    actorId?: string,
  ): Promise<{ ended: EnrollmentDto; created: EnrollmentDto }>;
  /** Vuelve a activar una inscripción finalizada, sin fecha de fin; queda auditado. */
  reactivate(id: string, actorId?: string): Promise<EnrollmentDto>;
  hasActiveForStudent(studentId: string): Promise<boolean>;
  hasActiveForClass(classId: string): Promise<boolean>;
}
