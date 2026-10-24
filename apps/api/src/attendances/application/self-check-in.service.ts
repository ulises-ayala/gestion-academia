import type { SelfCheckInDto } from '@academy/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { businessDayAt, businessMinutesAt } from '../../dashboard/application/business-day';
import { pickSelfCheckInClass, selfCheckInDniCandidates } from '../domain/self-check-in';
import { SELF_CHECK_IN_REPOSITORY, type SelfCheckInRepository } from './self-check-in.repository';

const timezone = () => process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires';

@Injectable()
export class SelfCheckInService {
  constructor(
    @Inject(SELF_CHECK_IN_REPOSITORY)
    private readonly repository: SelfCheckInRepository,
  ) {}

  async checkIn(dni: unknown, now = new Date()): Promise<SelfCheckInDto> {
    const dniCandidates = selfCheckInDniCandidates(dni);
    const student = await this.repository.findStudentByDni(dniCandidates);
    if (!student || student.status !== 'ACTIVE')
      return { outcome: 'STUDENT_NOT_FOUND', student: null, class: null, paymentStatus: null };

    const day = businessDayAt(now, timezone());
    const [candidates, overdue] = await Promise.all([
      this.repository.candidates(student.id, day.dateValue, day.dayOfWeek),
      this.repository.hasOverdueCharges(student.id, day.dateValue),
    ]);
    const studentName = { firstName: student.firstName, lastName: student.lastName };
    const paymentStatus = overdue ? 'OVERDUE' : 'UP_TO_DATE';
    const pick = pickSelfCheckInClass(candidates, businessMinutesAt(now, timezone()));
    if (!pick) return { outcome: 'NO_CLASS_NOW', student: studentName, class: null, paymentStatus };

    if (!pick.alreadyPresent)
      await this.repository.markPresent(pick.candidate.enrollmentId, day.dateValue);
    return {
      outcome: pick.alreadyPresent ? 'ALREADY_CHECKED_IN' : 'CHECKED_IN',
      student: studentName,
      class: {
        name: pick.candidate.className,
        startTime: pick.candidate.startTime,
        endTime: pick.candidate.endTime,
      },
      paymentStatus,
    };
  }
}
