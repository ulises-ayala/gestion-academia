import { describe, expect, it } from 'vitest';
import {
  buildOtherPaymentPayload,
  describeOtherPayment,
  otherPaymentProblem,
} from './other-payment';

const none = { CASH: '', MERCADO_PAGO: '', CARD: '' };
describe('otros cobros', () => {
  it('describe a qué corresponde el cobro', () => {
    expect(
      describeOtherPayment({
        concept: 'SINGLE_CLASS',
        detail: null,
        academicClass: { id: 'c', name: 'Zumba' },
        teacher: null,
      }),
    ).toBe('Clase suelta · Zumba');
    expect(
      describeOtherPayment({
        concept: 'SINGLE_CLASS',
        detail: null,
        academicClass: { id: 'c', name: 'Zumba' },
        teacher: { id: 't', firstName: 'Jose Luis', lastName: 'Barrios' },
      }),
    ).toBe('Clase suelta · Zumba · Prof. Jose Luis Barrios');
    expect(
      describeOtherPayment({
        concept: 'OTHER',
        detail: 'Remera del show',
        academicClass: null,
        teacher: null,
      }),
    ).toBe('Otro: Remera del show');
    expect(describeOtherPayment(null)).toBe('');
  });
  it('pide la clase, el detalle y el importe según el concepto', () => {
    expect(otherPaymentProblem({ concept: 'SINGLE_CLASS', classId: '', detail: '' }, none)).toBe(
      'Elegí la clase.',
    );
    expect(otherPaymentProblem({ concept: 'OTHER', classId: '', detail: ' a ' }, none)).toBe(
      'Contá brevemente qué se cobra.',
    );
    expect(otherPaymentProblem({ concept: 'OTHER', classId: '', detail: 'Remera' }, none)).toBe(
      'Ingresá el importe recibido.',
    );
    expect(
      otherPaymentProblem(
        { concept: 'SINGLE_CLASS', classId: 'c', detail: '' },
        { ...none, CASH: '8000' },
      ),
    ).toBeNull();
  });
  it('la clase suelta lleva el profesor que la dictó', () => {
    expect(
      buildOtherPaymentPayload(
        's',
        { concept: 'SINGLE_CLASS', classId: 'c', teacherId: 't2', detail: '' },
        { ...none, CASH: '8000' },
      ),
    ).toMatchObject({ concept: 'SINGLE_CLASS', classId: 'c', teacherId: 't2' });
  });
  it('arma el cobro: la clase solo viaja en la clase suelta', () => {
    expect(
      buildOtherPaymentPayload(
        's',
        { concept: 'OTHER', classId: 'c', detail: ' Remera ' },
        { CASH: '5000', MERCADO_PAGO: '2500,50', CARD: '' },
      ),
    ).toEqual({
      studentId: 's',
      concept: 'OTHER',
      classId: null,
      teacherId: null,
      detail: 'Remera',
      tenders: [
        { method: 'CASH', amount: '5000.00' },
        { method: 'MERCADO_PAGO', amount: '2500.50' },
      ],
    });
  });
});
