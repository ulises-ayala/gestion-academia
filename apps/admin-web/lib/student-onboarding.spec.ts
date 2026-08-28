import type { ClassDto, TariffDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import { buildOnboardingPayload, onboardingTotal } from './student-onboarding';

describe('student onboarding helpers', () => {
  it('calcula el total visual y no envía amount', () => {
    const tariffs = [
      { id: 't1', amount: '40000.00' },
      { id: 't2', amount: '30000.00' },
    ] as TariffDto[];
    const selections = [
      { classId: 'c1', tariffId: 't1' },
      { classId: 'c2', tariffId: 't2' },
    ];
    expect(onboardingTotal(selections, tariffs)).toBe(70000);
    expect(
      buildOnboardingPayload(
        { dni: '1', firstName: 'Ana', lastName: 'Paz' },
        selections,
        '2026-08',
        '2026-08-10',
        true,
        'CASH',
      ),
    ).toEqual({
      student: { dni: '1', firstName: 'Ana', lastName: 'Paz' },
      enrollments: selections,
      period: '2026-08',
      dueDate: '2026-08-10',
      payment: { paymentMethod: 'CASH' },
    });
  });
  it('mantiene el alta simple sin datos financieros', () =>
    expect(
      buildOnboardingPayload(
        { dni: '1', firstName: 'Ana', lastName: 'Paz' },
        [],
        '2026-08',
        '2026-08-10',
        false,
        'CARD',
      ),
    ).toMatchObject({ enrollments: [], payment: null }));
});
