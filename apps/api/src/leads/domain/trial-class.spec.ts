import { describe, expect, it } from 'vitest';
import {
  statusAfterTrial,
  validateTrialClass,
  sameFirstName,
  statusAfterVisit,
  validateTrialVisit,
} from './trial-class';

const today = '2026-11-02';

describe('clase de prueba', () => {
  it('toma hoy por defecto y normaliza la nota', () => {
    expect(
      validateTrialClass({ classId: 'class-1', notes: '  vino con una amiga ' }, today),
    ).toEqual({ classId: 'class-1', trialDate: today, notes: 'vino con una amiga' });
    expect(validateTrialClass({ classId: 'class-1', trialDate: '2026-10-30' }, today)).toEqual({
      classId: 'class-1',
      trialDate: '2026-10-30',
      notes: null,
    });
  });

  it('exige la clase y rechaza fechas futuras o inválidas', () => {
    expect(() => validateTrialClass({}, today)).toThrow(
      expect.objectContaining({ details: { field: 'classId' } }),
    );
    expect(() => validateTrialClass({ classId: 'c', trialDate: '2026-11-03' }, today)).toThrow(
      'La clase de prueba no puede ser futura',
    );
    expect(() => validateTrialClass({ classId: 'c', trialDate: '2026-02-30' }, today)).toThrow(
      'La fecha de la prueba no es válida',
    );
  });

  it('pasa a "Clase de prueba" solo a quien consultó o estaba interesado', () => {
    expect(statusAfterTrial('INQUIRY')).toBe('TRIAL');
    expect(statusAfterTrial('INTERESTED')).toBe('TRIAL');
    expect(statusAfterTrial('ENROLLED')).toBe('ENROLLED');
    expect(statusAfterTrial('NOT_CONVERTED')).toBe('NOT_CONVERTED');
  });

  it('reconoce a la misma persona por el nombre de pila, sin tildes ni mayúsculas', () => {
    expect(sameFirstName('Lucía Martínez', 'lucia')).toBe(true);
    expect(sameFirstName('María Laura Gómez', 'MARÍA')).toBe(true);
    // Hermanos con el teléfono de la madre: no son la misma persona.
    expect(sameFirstName('Tomás Pérez', 'Juana Pérez')).toBe(false);
    expect(sameFirstName('', '')).toBe(false);
  });

  it('una visita de prueba lo vuelve a "Clase de prueba", salvo que ya sea alumno', () => {
    expect(statusAfterVisit({ status: 'NOT_CONVERTED', studentId: null })).toBe('TRIAL');
    expect(statusAfterVisit({ status: 'INQUIRY', studentId: null })).toBe('TRIAL');
    expect(statusAfterVisit({ status: 'ENROLLED', studentId: 's1' })).toBe('ENROLLED');
  });

  it('arma el potencial de la visita y exige el teléfono', () => {
    const { person, trial } = validateTrialVisit(
      { firstName: ' Lucía ', lastName: 'Martínez', phone: '370 503-2792', classId: 'c1' },
      '2026-11-13',
    );
    expect(person).toMatchObject({
      name: 'Lucía Martínez',
      phone: '370 503-2792',
      normalizedPhone: '3705032792',
      source: 'IN_PERSON',
      status: 'TRIAL',
    });
    expect(trial).toEqual({ classId: 'c1', trialDate: '2026-11-13', notes: null });
    expect(
      validateTrialVisit(
        { firstName: 'Flor', phone: '3705032792', classId: 'c1', source: 'WHATSAPP' },
        '2026-11-13',
      ).person,
    ).toMatchObject({ name: 'Flor', source: 'WHATSAPP' });
    expect(() => validateTrialVisit({ firstName: 'Flor', classId: 'c1' }, '2026-11-13')).toThrow(
      expect.objectContaining({ details: { field: 'phone' } }),
    );
    expect(() =>
      validateTrialVisit({ firstName: ' ', phone: '3705032792', classId: 'c1' }, '2026-11-13'),
    ).toThrow(expect.objectContaining({ details: { field: 'firstName' } }));
  });
});
