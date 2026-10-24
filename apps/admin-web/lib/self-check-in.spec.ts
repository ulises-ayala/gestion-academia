import type { SelfCheckInDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import { checkInMessage, idleCapture, reduceCaptureKey, type CaptureState } from './self-check-in';

const type = (keys: string[], state: CaptureState = idleCapture) =>
  keys.reduce<{ state: CaptureState; actions: string[] }>(
    (acc, key) => {
      const next = reduceCaptureKey(acc.state, key);
      return { state: next.state, actions: [...acc.actions, next.action] };
    },
    { state, actions: [] },
  );
const dto = (overrides: Partial<SelfCheckInDto>): SelfCheckInDto => ({
  outcome: 'CHECKED_IN',
  student: { firstName: 'Lucía', lastName: 'Gómez' },
  class: { name: 'Salsa inicial', startTime: '18:00', endTime: '19:00' },
  paymentStatus: 'UP_TO_DATE',
  ...overrides,
});

describe('reduceCaptureKey', () => {
  it('ignora teclas mientras no se apretó el numeral', () => {
    expect(type(['4', '5', 'a']).actions).toEqual(['ignore', 'ignore', 'ignore']);
  });

  it('envía al completar 8 dígitos después del numeral', () => {
    const result = type(['#', ...'45381931'.split('')]);
    expect(result.actions.at(-1)).toBe('submit');
    expect(result.state).toEqual({ active: false, digits: '45381931' });
  });

  it('envía un DNI de 7 dígitos escrito con 0 adelante', () => {
    expect(type(['#', ...'08765432'.split('')]).state.digits).toBe('08765432');
  });

  it('borra con Retroceso, cancela con Escape y reinicia con otro numeral', () => {
    expect(type(['#', '4', '5', 'Backspace']).state.digits).toBe('4');
    expect(type(['#', '4', 'Escape'])).toMatchObject({ state: idleCapture });
    expect(type(['#', '4', '5', '#']).state).toEqual({ active: true, digits: '' });
  });

  it('no envía antes de tiempo ni con teclas que no son dígitos', () => {
    const result = type(['#', '4', 'a', '5', '-']);
    expect(result.state.digits).toBe('45');
    expect(result.actions).not.toContain('submit');
  });
});

describe('checkInMessage', () => {
  it('confirma el presente con la clase y la cuota al día', () => {
    expect(checkInMessage(dto({}))).toMatchObject({
      tone: 'success',
      title: '¡Hola, Lucía! Presente',
      detail: 'Salsa inicial · 18:00 a 19:00',
      payment: { tone: 'ok', text: 'Cuota al día' },
    });
  });

  it('avisa una deuda de forma discreta, sin montos', () => {
    const message = checkInMessage(dto({ paymentStatus: 'OVERDUE' }));
    expect(message.payment).toEqual({
      tone: 'pending',
      text: 'Tenés un pago pendiente. Acercate a recepción.',
    });
    const visibleText = [message.title, message.detail, message.payment?.text].join(' ');
    expect(visibleText).not.toMatch(/\$|\d{3,}/);
  });

  it('distingue presente repetido, sin clase y DNI inexistente', () => {
    expect(checkInMessage(dto({ outcome: 'ALREADY_CHECKED_IN' })).title).toBe(
      'Lucía, ya tenías el presente',
    );
    expect(checkInMessage(dto({ outcome: 'NO_CLASS_NOW', class: null })).detail).toBe(
      'Acercate a recepción.',
    );
    expect(
      checkInMessage({
        outcome: 'STUDENT_NOT_FOUND',
        student: null,
        class: null,
        paymentStatus: null,
      }),
    ).toMatchObject({ title: 'No encontramos ese DNI', payment: null });
  });
});
