import type { TariffDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import { billingTermsLabel, modalityOptions } from './enrollment-billing';

const tariff = (over: Partial<TariffDto>): TariffDto => ({
  id: 't',
  classId: 'c1',
  name: 'Completa',
  amount: '40000.00',
  validFrom: '2026-09-01',
  validTo: null,
  status: 'ACTIVE',
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('condiciones de cobro de la inscripción', () => {
  it('ofrece las tarifas activas y vigentes de la clase, de mayor a menor', () => {
    const options = modalityOptions(
      [
        tariff({ id: 'reducida', name: 'Reducida', amount: '25000.00' }),
        tariff({ id: 'completa' }),
        tariff({ id: 'vieja', validTo: '2026-10-31' }),
        tariff({ id: 'inactiva', status: 'INACTIVE' }),
        tariff({ id: 'otra-clase', classId: 'c2' }),
      ],
      'c1',
      '2026-11-01',
    );
    expect(options.map(({ id }) => id)).toEqual(['completa', 'reducida']);
    expect(options[1]!.label).toMatch(/^Reducida · \$\s?25\.000,00$/);
  });

  it('resume modalidad y día de pago', () => {
    expect(billingTermsLabel({ tariff: null, paymentDueDay: 10 })).toBe(
      'Tarifa de la clase · paga el día 10',
    );
    expect(
      billingTermsLabel({
        tariff: { id: 'r', name: 'Reducida', amount: '25000.00' },
        paymentDueDay: 20,
      }),
    ).toMatch(/^Reducida \(\$\s?25\.000,00\) · paga el día 20$/);
  });
});
