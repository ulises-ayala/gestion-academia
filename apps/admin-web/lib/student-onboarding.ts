import type {
  ClassDto,
  CreateStudentDto,
  CreateStudentOnboardingDto,
  PaymentMethodDto,
  TariffDto,
} from '@academy/contracts';

export type OnboardingSelection = Readonly<{ classId: string; tariffId: string }>;
export const onboardingTotal = (
  items: readonly OnboardingSelection[],
  tariffs: readonly TariffDto[],
) => {
  const amounts = new Map(tariffs.map((tariff) => [tariff.id, Number(tariff.amount)]));
  return items.reduce((sum, item) => sum + (amounts.get(item.tariffId) ?? 0), 0);
};
export const buildOnboardingPayload = (
  student: CreateStudentDto,
  selections: readonly OnboardingSelection[],
  period: string,
  dueDate: string,
  collect: boolean,
  paymentMethod: PaymentMethodDto,
): CreateStudentOnboardingDto => ({
  student,
  enrollments: selections,
  ...(selections.length ? { period, dueDate } : {}),
  payment: selections.length && collect ? { paymentMethod } : null,
});
const overlaps = (left: ClassDto['schedules'][number], right: ClassDto['schedules'][number]) =>
  left.dayOfWeek === right.dayOfWeek &&
  left.startTime < right.endTime &&
  right.startTime < left.endTime;
export const selectedClassConflict = (
  selections: readonly OnboardingSelection[],
  classes: readonly ClassDto[],
) => {
  const selected = selections
    .map(({ classId }) => classes.find(({ id }) => id === classId))
    .filter((item): item is ClassDto => Boolean(item));
  for (let left = 0; left < selected.length; left++)
    for (let right = left + 1; right < selected.length; right++)
      if (
        selected[left]!.schedules.some((a) =>
          selected[right]!.schedules.some((b) => overlaps(a, b)),
        )
      )
        return [selected[left]!, selected[right]!] as const;
  return null;
};
