export type WeeklyScheduleInterval = Readonly<{
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}>;

export const schedulesOverlap = (
  left: WeeklyScheduleInterval,
  right: WeeklyScheduleInterval,
): boolean =>
  left.dayOfWeek === right.dayOfWeek &&
  left.startTime < right.endTime &&
  right.startTime < left.endTime;
