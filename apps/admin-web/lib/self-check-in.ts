import type { SelfCheckInDto } from '@academy/contracts';

/** Tecla que inicia el autoregistro desde el teclado numérico de recepción. */
export const SELF_CHECK_IN_TRIGGER = '#';
/** El teclado no tiene Enter: se envía al completar 8 dígitos (7 dígitos: 0 adelante). */
export const SELF_CHECK_IN_DNI_LENGTH = 8;
export const SELF_CHECK_IN_TYPING_TIMEOUT_MS = 12_000;
export const SELF_CHECK_IN_RESULT_MS = 6_000;
export const SELF_CHECK_IN_NOT_FOUND_MS = 4_000;

export type CaptureState = Readonly<{ active: boolean; digits: string }>;
export type CaptureAction = 'ignore' | 'start' | 'type' | 'submit' | 'cancel';

export const idleCapture: CaptureState = { active: false, digits: '' };

/**
 * Interpreta una tecla. Con la captura inactiva solo el numeral importa; activa, toma
 * dígitos, borra con Retroceso, cancela con Escape y envía al llegar a 8 dígitos.
 */
export function reduceCaptureKey(
  state: CaptureState,
  key: string,
): Readonly<{ state: CaptureState; action: CaptureAction }> {
  if (key === SELF_CHECK_IN_TRIGGER)
    return { state: { active: true, digits: '' }, action: 'start' };
  if (!state.active) return { state, action: 'ignore' };
  if (key === 'Escape') return { state: idleCapture, action: 'cancel' };
  if (key === 'Backspace')
    return { state: { active: true, digits: state.digits.slice(0, -1) }, action: 'type' };
  if (!/^\d$/.test(key)) return { state, action: 'type' };
  const digits = `${state.digits}${key}`;
  return digits.length >= SELF_CHECK_IN_DNI_LENGTH
    ? {
        state: { active: false, digits: digits.slice(0, SELF_CHECK_IN_DNI_LENGTH) },
        action: 'submit',
      }
    : { state: { active: true, digits }, action: 'type' };
}

export type CheckInMessage = Readonly<{
  tone: 'success' | 'info' | 'warning';
  title: string;
  detail: string;
  /** Profesor y salón de la clase marcada. */
  location: string;
  /** Aviso de cuota sin montos, para que no lo lean los demás. */
  payment: Readonly<{ tone: 'ok' | 'pending'; text: string }> | null;
  durationMs: number;
}>;

const paymentNotice = (status: SelfCheckInDto['paymentStatus']): CheckInMessage['payment'] =>
  status === 'OVERDUE'
    ? { tone: 'pending', text: 'Tenés un pago pendiente. Acercate a recepción.' }
    : status === 'UP_TO_DATE'
      ? { tone: 'ok', text: 'Cuota al día' }
      : null;

const classLabel = (dto: SelfCheckInDto) =>
  dto.class ? `${dto.class.name} · ${dto.class.startTime} a ${dto.class.endTime}` : '';
const locationLabel = (dto: SelfCheckInDto) =>
  dto.class ? `Prof. ${dto.class.teacherName} · ${dto.class.roomName}` : '';

export function checkInMessage(dto: SelfCheckInDto): CheckInMessage {
  const firstName = dto.student?.firstName ?? '';
  if (dto.outcome === 'CHECKED_IN')
    return {
      tone: 'success',
      title: `¡Hola, ${firstName}! Presente`,
      detail: classLabel(dto),
      location: locationLabel(dto),
      payment: paymentNotice(dto.paymentStatus),
      durationMs: SELF_CHECK_IN_RESULT_MS,
    };
  if (dto.outcome === 'ALREADY_CHECKED_IN')
    return {
      tone: 'info',
      title: `${firstName}, ya tenías el presente`,
      detail: classLabel(dto),
      location: locationLabel(dto),
      payment: paymentNotice(dto.paymentStatus),
      durationMs: SELF_CHECK_IN_RESULT_MS,
    };
  if (dto.outcome === 'NO_CLASS_NOW')
    return {
      tone: 'warning',
      title: `${firstName}, no tenés una clase en este horario`,
      detail: 'Acercate a recepción.',
      location: '',
      payment: paymentNotice(dto.paymentStatus),
      durationMs: SELF_CHECK_IN_RESULT_MS,
    };
  return {
    tone: 'warning',
    title: 'No encontramos ese DNI',
    detail: 'Acercate a recepción.',
    location: '',
    payment: null,
    durationMs: SELF_CHECK_IN_NOT_FOUND_MS,
  };
}

export const checkInFailureMessage: CheckInMessage = {
  tone: 'warning',
  title: 'No pudimos registrar la asistencia',
  detail: 'Avisá en recepción.',
  location: '',
  payment: null,
  durationMs: SELF_CHECK_IN_NOT_FOUND_MS,
};
