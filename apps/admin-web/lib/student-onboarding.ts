import type {
  ClassDto,
  CreateStudentDto,
  CreateStudentOnboardingDto,
  LeadDto,
  LeadTrialClassDto,
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
  leadId: string | null = null,
): CreateStudentOnboardingDto => ({
  student,
  ...(leadId ? { leadId } : {}),
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

/** Tarifas de una clase que rigen en el mes (AAAA-MM). */
export const classTariffsFor = (tariffs: readonly TariffDto[], classId: string, period: string) =>
  tariffs.filter(
    (tariff) =>
      tariff.classId === classId &&
      tariff.validFrom.slice(0, 7) <= period &&
      (!tariff.validTo || tariff.validTo.slice(0, 7) >= period),
  );

/**
 * Nombre y apellido a partir del nombre cargado en el potencial alumno: la última palabra es el
 * apellido ("María Laura Gómez" → "María Laura" / "Gómez"). Se revisa en el alta.
 */
export const splitLeadName = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { firstName: words[0] ?? '', lastName: '' };
  return { firstName: words.slice(0, -1).join(' '), lastName: words.at(-1)! };
};

/** Datos del alta que salen del potencial alumno. El DNI siempre se completa a mano. */
export const studentDraftFromLead = (lead: Pick<LeadDto, 'name' | 'phone' | 'email'>) => ({
  ...splitLeadName(lead.name),
  phone: lead.phone ?? '',
  email: lead.email ?? '',
});

/**
 * Inscripción sugerida: la clase de prueba más reciente que sigue activa y tiene tarifa para el
 * mes, con la primera de sus tarifas. Null si ninguna sirve.
 */
export const selectionFromTrials = (
  trials: readonly LeadTrialClassDto[],
  classes: readonly ClassDto[],
  tariffs: readonly TariffDto[],
  period: string,
): OnboardingSelection | null => {
  const latestFirst = [...trials].sort((left, right) =>
    right.trialDate.localeCompare(left.trialDate),
  );
  for (const trial of latestFirst) {
    const classId = trial.academicClass.id;
    if (!classes.some(({ id }) => id === classId)) continue;
    const tariff = classTariffsFor(tariffs, classId, period)[0];
    if (tariff) return { classId, tariffId: tariff.id };
  }
  return null;
};
