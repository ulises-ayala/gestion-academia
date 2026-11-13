import {
  schedulesOverlap,
  type WeeklyScheduleInterval,
} from '../../shared/domain/schedule-overlap';

export type EnrollmentScheduleCandidate = Readonly<{
  classId: string;
  className: string;
  schedules: readonly WeeklyScheduleInterval[];
}>;

export type EnrollmentScheduleConflict = Readonly<{
  classId: string;
  className: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}>;

export const findEnrollmentScheduleConflict = (
  requestedSchedules: readonly WeeklyScheduleInterval[],
  existingEnrollments: readonly EnrollmentScheduleCandidate[],
): EnrollmentScheduleConflict | null => {
  for (const enrollment of existingEnrollments)
    for (const existingSchedule of enrollment.schedules)
      if (requestedSchedules.some((requested) => schedulesOverlap(requested, existingSchedule)))
        return {
          classId: enrollment.classId,
          className: enrollment.className,
          dayOfWeek: existingSchedule.dayOfWeek,
          startTime: existingSchedule.startTime,
          endTime: existingSchedule.endTime,
        };
  return null;
};
