import { describe, expect, it } from 'vitest';
import {
  minutesOfDay,
  pickSelfCheckInClass,
  selfCheckInDniCandidates,
  type SelfCheckInCandidate,
} from './self-check-in';

const candidate = (
  startTime: string,
  endTime: string,
  overrides: Partial<SelfCheckInCandidate> = {},
): SelfCheckInCandidate => ({
  enrollmentId: `${startTime}-${endTime}`,
  className: `Clase ${startTime}`,
  startTime,
  endTime,
  attendanceStatus: null,
  ...overrides,
});
const at = (time: string) => minutesOfDay(time);

describe('selfCheckInDniCandidates', () => {
  it('acepta exactamente 8 dígitos', () => {
    expect(selfCheckInDniCandidates('45381931')).toEqual(['45381931']);
  });

  it('busca también sin el 0 inicial para DNI de 7 dígitos', () => {
    expect(selfCheckInDniCandidates('08765432')).toEqual(['08765432', '8765432']);
  });

  it.each(['4538193', '453819311', '4538193a', '', null, 45381931])('rechaza %s', (value) => {
    expect(() => selfCheckInDniCandidates(value)).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('no busca un DNI vacío cuando son todos ceros', () => {
    expect(selfCheckInDniCandidates('00000000')).toEqual(['00000000']);
  });
});

describe('pickSelfCheckInClass', () => {
  it('marca la clase en curso', () => {
    expect(
      pickSelfCheckInClass([candidate('18:00', '19:00')], at('18:20'))?.candidate.startTime,
    ).toBe('18:00');
  });

  it('acepta desde 30 minutos antes y hasta el final, no fuera de ese margen', () => {
    const classes = [candidate('18:00', '19:00')];
    expect(pickSelfCheckInClass(classes, at('17:30'))).not.toBeNull();
    expect(pickSelfCheckInClass(classes, at('19:00'))).not.toBeNull();
    expect(pickSelfCheckInClass(classes, at('17:29'))).toBeNull();
    expect(pickSelfCheckInClass(classes, at('19:01'))).toBeNull();
  });

  it('prefiere la clase en curso sobre la próxima', () => {
    const classes = [candidate('19:00', '20:00'), candidate('18:00', '19:00')];
    expect(pickSelfCheckInClass(classes, at('18:50'))?.candidate.startTime).toBe('18:00');
  });

  it('con dos clases seguidas, marca la siguiente si la primera ya tiene presente', () => {
    const classes = [
      candidate('18:00', '19:00', { attendanceStatus: 'PRESENT' }),
      candidate('19:00', '20:00'),
    ];
    expect(pickSelfCheckInClass(classes, at('18:50'))).toEqual({
      candidate: classes[1],
      alreadyPresent: false,
    });
  });

  it('avisa si ya estaba presente en todas las clases posibles', () => {
    const classes = [candidate('18:00', '19:00', { attendanceStatus: 'PRESENT' })];
    expect(pickSelfCheckInClass(classes, at('18:10'))).toEqual({
      candidate: classes[0],
      alreadyPresent: true,
    });
  });

  it('pasa a presente una asistencia cargada antes como ausente', () => {
    const classes = [candidate('18:00', '19:00', { attendanceStatus: 'ABSENT' })];
    expect(pickSelfCheckInClass(classes, at('18:10'))?.alreadyPresent).toBe(false);
  });

  it('devuelve null sin clases en el horario', () => {
    expect(pickSelfCheckInClass([], at('10:00'))).toBeNull();
    expect(pickSelfCheckInClass([candidate('18:00', '19:00')], at('10:00'))).toBeNull();
  });
});
