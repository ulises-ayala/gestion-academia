import type { TariffDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import {
  addMonths,
  assertGenerationPeriod,
  assertPeriodAllowed,
  pickTariff,
} from './charge-generation';

const tariff = (over: Partial<TariffDto>): TariffDto => ({
  id: crypto.randomUUID(),
  classId: 'c',
  name: 'Mensual',
  amount: '40000.00',
  validFrom: '2026-09-01',
  validTo: null,
  status: 'ACTIVE',
  createdAt: '',
  updatedAt: '',
  ...over,
});
const allowed = (
  period: string,
  canBackfill = false,
  start = '2026-03-01',
  end: string | null = null,
) =>
  assertPeriodAllowed({
    period,
    currentPeriod: '2026-10',
    canBackfill,
    enrollmentStart: start,
    enrollmentEnd: end,
  });

describe('generación de cuotas', () => {
  it('suma meses cruzando el año', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
  it('valida el formato del mes', () => {
    expect(assertGenerationPeriod('2026-11')).toBe('2026-11');
    for (const bad of ['2026-13', '2026-1', '', null, '2026-11-01'])
      expect(() => assertGenerationPeriod(bad)).toThrow('AAAA-MM');
  });
  it('permite el mes actual y hasta dos adelantados', () => {
    expect(() => allowed('2026-10')).not.toThrow();
    expect(() => allowed('2026-12')).not.toThrow();
    expect(() => allowed('2027-01')).toThrow(/2 meses por adelantado/);
  });
  it('los meses anteriores solo los genera quien gestiona cuotas', () => {
    expect(() => allowed('2026-09')).toThrow('Administración');
    expect(() => allowed('2026-09', true)).not.toThrow();
  });
  it('no genera fuera de las fechas de la inscripción', () => {
    expect(() => allowed('2026-08', true, '2026-09-15')).toThrow(/empieza en septiembre de 2026/);
    expect(() => allowed('2026-09', true, '2026-09-15')).not.toThrow();
    expect(() => allowed('2026-11', false, '2026-03-01', '2026-10-31')).toThrow(/terminó/);
  });
  it('usa la tarifa activa que cubre el mes', () => {
    const current = tariff({ validFrom: '2026-09-01' });
    const old = tariff({ validFrom: '2026-07-01', validTo: '2026-08-31', status: 'INACTIVE' });
    expect(pickTariff([current, old], '2026-11', '2026-10')).toBe(current);
  });
  it('para meses pasados acepta la tarifa histórica inactiva', () => {
    const current = tariff({ validFrom: '2026-09-01' });
    const august = tariff({ validFrom: '2026-08-01', validTo: '2026-08-31', status: 'INACTIVE' });
    expect(pickTariff([current, august], '2026-08', '2026-10')).toBe(august);
  });
  it('no usa una tarifa inactiva para el mes actual o adelantado: la ofrece para activar', () => {
    const inactive = tariff({ id: 't-off', name: 'Zumba mensual', status: 'INACTIVE' });
    const outdated = tariff({ validTo: '2026-08-31', status: 'INACTIVE' });
    let caught: unknown;
    try {
      pickTariff([inactive, outdated], '2026-10', '2026-10');
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      code: 'TARIFF_NOT_FOUND_FOR_PERIOD',
      message: 'La tarifa de la clase para octubre de 2026 está desactivada.',
      details: { inactiveTariffs: [{ id: 't-off', name: 'Zumba mensual', amount: '40000.00' }] },
    });
  });
  it('sin ninguna tarifa cargada pide crearla', () => {
    expect(() => pickTariff([], '2026-10', '2026-10')).toThrow(/ninguna tarifa cargada/);
  });
  it('si la tarifa no cubre el mes dice desde cuándo rige', () => {
    const november = tariff({ name: 'Zumba mensual', validFrom: '2026-11-01' });
    expect(() => pickTariff([november], '2026-10', '2026-10')).toThrow(
      'La clase no tiene una tarifa para octubre de 2026: “Zumba mensual” rige desde el 01/11/2026. Revisá las fechas en Tarifas.',
    );
    const ended = tariff({ name: 'Zumba vieja', validTo: '2026-09-30', status: 'INACTIVE' });
    expect(() => pickTariff([ended], '2026-10', '2026-10')).toThrow(
      /“Zumba vieja” rige del 01\/09\/2026 al 30\/09\/2026 y está desactivada/,
    );
  });
  it('si hay dos tarifas posibles no elige: pide revisar', () => {
    expect(() => pickTariff([tariff({}), tariff({})], '2026-10', '2026-10')).toThrow(/más de una/);
  });
});
