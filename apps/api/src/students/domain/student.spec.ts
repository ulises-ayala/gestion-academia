import { describe, expect, it } from 'vitest';
import { DomainError } from '../../shared/domain/domain-error';
import { normalizeDni, validateStudentInput } from './student';

describe('student validation', () => {
  it('normaliza el DNI y recorta los datos', () => {
    expect(normalizeDni(' 12.345.678 ')).toBe('12345678');
    expect(
      validateStudentInput({ dni: '12.345.678', firstName: ' Ana ', lastName: ' Pérez ' }),
    ).toMatchObject({
      dni: '12345678',
      firstName: 'Ana',
      lastName: 'Pérez',
      status: 'ACTIVE',
    });
  });

  it('rechaza una fecha de nacimiento futura', () => {
    expect(() =>
      validateStudentInput({
        dni: '12345678',
        firstName: 'Ana',
        lastName: 'Pérez',
        birthDate: '2999-01-01',
      }),
    ).toThrowError(DomainError);
  });

  it('rechaza nombres vacíos y correos inválidos', () => {
    expect(() =>
      validateStudentInput({ dni: '12345678', firstName: ' ', lastName: 'Pérez' }),
    ).toThrow('firstName es obligatorio');
    expect(() =>
      validateStudentInput({
        dni: '12345678',
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'incorrecto',
      }),
    ).toThrow('correo electrónico');
  });
});
