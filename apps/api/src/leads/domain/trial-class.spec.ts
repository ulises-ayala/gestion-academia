import { describe, expect, it } from 'vitest';
import { statusAfterTrial, validateTrialClass } from './trial-class';

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
});
