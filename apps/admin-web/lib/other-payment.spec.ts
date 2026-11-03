import { describe, expect, it } from 'vitest';
import {
  buildOtherPaymentPayload,
  buildWalkInPaymentPayload,
  describeOtherPayment,
  otherPaymentProblem,
  walkInProblem,
} from './other-payment';

const none = { CASH: '', MERCADO_PAGO: '', TRANSFER: '', CARD: '' };
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
    expect(
      describeOtherPayment({
        concept: 'APPAREL',
        detail: 'Remera talle M',
        academicClass: null,
        teacher: null,
      }),
    ).toBe('Indumentaria (Remera talle M)');
    expect(
      describeOtherPayment({
        concept: 'GALA_SEAL',
        detail: null,
        academicClass: null,
        teacher: null,
      }),
    ).toBe('Precintos de la Gala');
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
        { CASH: '5000', MERCADO_PAGO: '2500,50', TRANSFER: '', CARD: '' },
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

describe('alumno eventual', () => {
  it('exige el nombre y valida el DNI solo si se carga', () => {
    expect(walkInProblem({ name: ' L ', phone: '', dni: '' })).toBe(
      'Escribí el nombre del alumno eventual.',
    );
    expect(walkInProblem({ name: 'Lucía', phone: '', dni: '123' })).toBe(
      'El DNI debe tener entre 6 y 9 dígitos.',
    );
    expect(walkInProblem({ name: 'Lucía', phone: '', dni: '30.111.222' })).toBeNull();
    expect(walkInProblem({ name: 'Lucía', phone: '', dni: '' })).toBeNull();
  });

  it('arma la clase suelta sin alumno y con los datos del eventual', () => {
    expect(
      buildWalkInPaymentPayload(
        { name: ' Lucía Gómez ', phone: ' ', dni: '30111222' },
        { concept: 'SINGLE_CLASS', classId: 'class-1', teacherId: '', detail: '' },
        { ...none, CASH: '8000' },
      ),
    ).toEqual({
      walkIn: { name: 'Lucía Gómez', phone: null, dni: '30111222' },
      tenders: [{ method: 'CASH', amount: '8000.00' }],
      concept: 'SINGLE_CLASS',
      classId: 'class-1',
      teacherId: null,
      detail: null,
    });
  });
});
