import type { ClassDto, LeadTrialClassDto, TariffDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import {
  buildOnboardingPayload,
  classTariffsFor,
  selectionFromTrials,
  splitLeadName,
  studentDraftFromLead,
} from './student-onboarding';

const tariff = (
  id: string,
  classId: string,
  validFrom = '2026-01-01',
  validTo: string | null = null,
) => ({ id, classId, name: id, amount: '40000.00', validFrom, validTo }) as TariffDto;
const trial = (classId: string, trialDate: string) =>
  ({
    id: `t-${classId}`,
    academicClass: { id: classId, name: classId },
    trialDate,
  }) as LeadTrialClassDto;
const classes = [{ id: 'salsa' }, { id: 'bachata' }] as ClassDto[];

describe('alta desde un potencial alumno', () => {
  it('separa nombre y apellido con la última palabra como apellido', () => {
    expect(splitLeadName('Lucía Martínez')).toEqual({ firstName: 'Lucía', lastName: 'Martínez' });
    expect(splitLeadName('  María Laura   Gómez ')).toEqual({
      firstName: 'María Laura',
      lastName: 'Gómez',
    });
    expect(splitLeadName('Flor')).toEqual({ firstName: 'Flor', lastName: '' });
  });

  it('precarga nombre, apellido, teléfono y correo', () => {
    expect(studentDraftFromLead({ name: 'Ana Pérez', phone: '370 503-2792', email: null })).toEqual(
      { firstName: 'Ana', lastName: 'Pérez', phone: '370 503-2792', email: '' },
    );
  });

  it('filtra las tarifas de la clase que rigen en el mes', () => {
    const tariffs = [
      tariff('vieja', 'salsa', '2025-01-01', '2025-12-31'),
      tariff('actual', 'salsa'),
      tariff('otra-clase', 'bachata'),
    ];
    expect(classTariffsFor(tariffs, 'salsa', '2026-11').map(({ id }) => id)).toEqual(['actual']);
  });

  it('elige la clase de prueba más reciente que siga activa y tenga tarifa', () => {
    const tariffs = [tariff('t-salsa', 'salsa'), tariff('t-bachata', 'bachata')];
    expect(
      selectionFromTrials(
        [trial('salsa', '2026-10-01'), trial('bachata', '2026-11-04')],
        classes,
        tariffs,
        '2026-11',
      ),
    ).toEqual({ classId: 'bachata', tariffId: 't-bachata' });
    // La más reciente ya no está activa: se usa la anterior.
    expect(
      selectionFromTrials(
        [trial('kizomba', '2026-11-05'), trial('salsa', '2026-10-01')],
        classes,
        tariffs,
        '2026-11',
      ),
    ).toEqual({ classId: 'salsa', tariffId: 't-salsa' });
    expect(selectionFromTrials([trial('salsa', '2026-10-01')], classes, [], '2026-11')).toBeNull();
    expect(selectionFromTrials([], classes, tariffs, '2026-11')).toBeNull();
  });

  it('manda el potencial solo cuando corresponde', () => {
    const student = { dni: '1', firstName: 'Ana', lastName: 'Paz' };
    expect(
      buildOnboardingPayload(student, [], '2026-11', '2026-11-10', false, 'CASH', 'lead-1'),
    ).toMatchObject({ leadId: 'lead-1' });
    expect(
      buildOnboardingPayload(student, [], '2026-11', '2026-11-10', false, 'CASH'),
    ).not.toHaveProperty('leadId');
  });
});
