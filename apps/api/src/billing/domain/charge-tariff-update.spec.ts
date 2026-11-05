import { Prisma } from '@academy/database';
import { describe, expect, it } from 'vitest';
import { assertTariffUpdatable } from './charge-tariff-update';

const d = (value: string) => new Prisma.Decimal(value);
const charge = {
  kind: 'MONTHLY',
  status: 'PENDING',
  tariffId: 'completa',
  baseAmount: d('40000'),
  paid: d('0'),
  adjustments: [],
};
const reducida = { id: 'reducida', amount: d('25000') };
const code = (code: string) => expect.objectContaining({ code });

describe('actualizar una cuota a la modalidad de la inscripción', () => {
  it('acepta una cuota mensual pendiente sin pagos ni ajustes', () => {
    expect(() => assertTariffUpdatable(charge, reducida)).not.toThrow();
  });

  it('acepta un ajuste que ya se revirtió', () => {
    const adjustments = [
      { id: 'beca', reversalOfId: null },
      { id: 'reversa', reversalOfId: 'beca' },
    ];
    expect(() => assertTariffUpdatable({ ...charge, adjustments }, reducida)).not.toThrow();
  });

  it.each([
    ['una deuda anterior', { kind: 'HISTORICAL_DEBT' }],
    ['una cuota con pago parcial', { status: 'PARTIAL' }],
    ['una cuota paga', { status: 'PAID' }],
    ['una cuota con algo imputado', { paid: d('0.01') }],
    ['una cuota con beca o recargo', { adjustments: [{ id: 'beca', reversalOfId: null }] }],
  ])('rechaza %s', (_label, over) => {
    expect(() => assertTariffUpdatable({ ...charge, ...over }, reducida)).toThrow(
      code('CHARGE_TARIFF_NOT_EDITABLE'),
    );
  });

  it('avisa si la cuota ya tiene esa tarifa e importe', () => {
    expect(() =>
      assertTariffUpdatable({ ...charge, tariffId: 'reducida', baseAmount: d('25000') }, reducida),
    ).toThrow(code('CHARGE_TARIFF_UNCHANGED'));
  });

  it('acepta la misma tarifa si cambió su importe', () => {
    expect(() =>
      assertTariffUpdatable({ ...charge, tariffId: 'reducida', baseAmount: d('28000') }, reducida),
    ).not.toThrow();
  });
});
