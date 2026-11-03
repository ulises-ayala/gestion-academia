import { describe, expect, it } from 'vitest';
import {
  assertConceptDetail,
  normalizeConceptName,
  validateOtherPayment,
  validatePaymentConcept,
} from './other-payment';

describe('conceptos de otros cobros', () => {
  it('un concepto del catálogo exige cuál es y no lleva clase', () => {
    expect(
      validateOtherPayment({
        concept: 'OTHER',
        conceptId: 'indumentaria',
        classId: 'c',
        detail: '',
      }),
    ).toEqual({
      concept: 'OTHER',
      conceptId: 'indumentaria',
      detail: null,
      classId: null,
      teacherId: null,
    });
    expect(() => validateOtherPayment({ concept: 'OTHER', detail: 'algo' })).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR', details: { field: 'conceptId' } }),
    );
  });

  it('el detalle es obligatorio solo si el concepto lo pide, y rechaza conceptos desconocidos', () => {
    expect(() => assertConceptDetail(true, null)).toThrow(
      expect.objectContaining({ details: { field: 'detail' } }),
    );
    expect(() => assertConceptDetail(false, null)).not.toThrow();
    expect(() => validateOtherPayment({ concept: 'APPAREL' })).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('valida el alta de un concepto y normaliza el nombre para no repetirlo', () => {
    expect(normalizeConceptName('  Entradas o Precintos  de la GALA ')).toBe(
      'entradas o precintos de la gala',
    );
    expect(normalizeConceptName('Inscripción')).toBe('inscripcion');
    expect(validatePaymentConcept({ name: ' Workshops ', requiresDetail: true })).toEqual({
      name: 'Workshops',
      normalizedName: 'workshops',
      requiresDetail: true,
    });
    // En una edición, lo que no se manda queda como estaba.
    expect(validatePaymentConcept({ name: 'Otros' })).not.toHaveProperty('requiresDetail');
    expect(() => validatePaymentConcept({ name: 'x' })).toThrow(
      expect.objectContaining({ details: { field: 'name' } }),
    );
  });
});
