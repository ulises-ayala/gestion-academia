import { describe, expect, it } from 'vitest';
import { validateOtherPayment } from './other-payment';

describe('conceptos de otros cobros', () => {
  it('indumentaria y precintos de la Gala no exigen detalle ni llevan clase', () => {
    expect(validateOtherPayment({ concept: 'APPAREL', classId: 'c', detail: '' })).toEqual({
      concept: 'APPAREL',
      detail: null,
      classId: null,
      teacherId: null,
    });
    expect(validateOtherPayment({ concept: 'GALA_SEAL', detail: ' 2 precintos ' })).toMatchObject({
      concept: 'GALA_SEAL',
      detail: '2 precintos',
    });
  });

  it('"Otro" sigue exigiendo detalle y rechaza conceptos desconocidos', () => {
    expect(() => validateOtherPayment({ concept: 'OTHER', detail: '' })).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
    expect(() => validateOtherPayment({ concept: 'CARD_FEE' })).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });
});
