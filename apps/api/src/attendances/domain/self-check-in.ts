import { DomainError } from '../../shared/domain/domain-error';
import type { AttendanceStatus } from './attendance';

/** El teclado de recepción no tiene Enter: el registro se dispara al completar 8 dígitos. */
export const SELF_CHECK_IN_DNI_LENGTH = 8;
/** Se puede marcar desde este margen antes del inicio hasta el final de la clase. */
export const SELF_CHECK_IN_MINUTES_BEFORE = 30;

/**
 * Devuelve los DNI a buscar. Un DNI de 7 dígitos se escribe con un 0 adelante
 * (`#08765432`), y los DNI se guardan sin ceros a la izquierda.
 */
export const selfCheckInDniCandidates = (value: unknown): readonly string[] => {
  if (typeof value !== 'string' || !new RegExp(`^\\d{${SELF_CHECK_IN_DNI_LENGTH}}$`).test(value))
    throw new DomainError(
      'VALIDATION_ERROR',
      `El DNI debe tener ${SELF_CHECK_IN_DNI_LENGTH} dígitos`,
      { field: 'dni' },
    );
  const withoutLeadingZeros = value.replace(/^0+/, '');
  return withoutLeadingZeros && withoutLeadingZeros !== value
    ? [value, withoutLeadingZeros]
    : [value];
};

export const minutesOfDay = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
};

export type SelfCheckInCandidate = Readonly<{
  enrollmentId: string;
  className: string;
  startTime: string;
  endTime: string;
  attendanceStatus: AttendanceStatus | null;
}>;

export type SelfCheckInPick = Readonly<{
  candidate: SelfCheckInCandidate;
  alreadyPresent: boolean;
}>;

/**
 * Elige la clase a marcar: primero la que está en curso, después la próxima que empieza
 * dentro del margen. Entre las elegibles prefiere una sin presente, así dos clases
 * seguidas se marcan por separado.
 */
export const pickSelfCheckInClass = (
  candidates: readonly SelfCheckInCandidate[],
  nowMinutes: number,
  minutesBefore = SELF_CHECK_IN_MINUTES_BEFORE,
): SelfCheckInPick | null => {
  const eligible = candidates
    .map((candidate) => ({
      candidate,
      start: minutesOfDay(candidate.startTime),
      end: minutesOfDay(candidate.endTime),
    }))
    .filter(({ start, end }) => nowMinutes >= start - minutesBefore && nowMinutes <= end)
    .sort((left, right) => {
      const leftRunning = nowMinutes >= left.start ? 0 : 1;
      const rightRunning = nowMinutes >= right.start ? 0 : 1;
      return leftRunning - rightRunning || left.start - right.start;
    });
  if (eligible.length === 0) return null;
  const pending = eligible.find(({ candidate }) => candidate.attendanceStatus !== 'PRESENT');
  return pending
    ? { candidate: pending.candidate, alreadyPresent: false }
    : { candidate: eligible[0]!.candidate, alreadyPresent: true };
};
