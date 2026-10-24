import type { DayOfWeekDto } from '@academy/contracts';
import type { SelfCheckInCandidate } from '../domain/self-check-in';

export const SELF_CHECK_IN_REPOSITORY = Symbol('SELF_CHECK_IN_REPOSITORY');

export type SelfCheckInStudent = Readonly<{
  id: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'INACTIVE';
}>;

export interface SelfCheckInRepository {
  findStudentByDni(dniCandidates: readonly string[]): Promise<SelfCheckInStudent | null>;

  /** Un candidato por horario activo del día, de inscripciones y clases vigentes. */
  candidates(
    studentId: string,
    attendanceDate: Date,
    dayOfWeek: DayOfWeekDto,
  ): Promise<readonly SelfCheckInCandidate[]>;

  markPresent(enrollmentId: string, attendanceDate: Date): Promise<void>;

  /** Cuotas con saldo pendiente y vencimiento anterior al día operativo. */
  hasOverdueCharges(studentId: string, businessDate: Date): Promise<boolean>;
}
