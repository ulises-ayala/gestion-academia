import { describe, expect, it } from 'vitest';
import { samePeriodEnrollmentError } from './enrollment';

const id = crypto.randomUUID();
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('Inscripción de la misma clase con período superpuesto', () => {
  it('indica hasta cuándo duró la anterior y desde cuándo puede empezar la nueva', () => {
    expect(
      samePeriodEnrollmentError(
        { id, startDate: day('2026-08-01'), endDate: day('2026-10-31') },
        false,
      ),
    ).toMatchObject({
      code: 'ENROLLMENT_PERIOD_OVERLAP',
      message: expect.stringContaining('hasta el 31/10/2026. Elegí un inicio desde el 01/11/2026'),
      details: { enrollmentId: id, endDate: '2026-10-31', nextStartDate: '2026-11-01' },
    });
  });

  it('explica la inscripción finalizada sin fecha de fin', () => {
    expect(
      samePeriodEnrollmentError({ id, startDate: day('2026-08-01'), endDate: null }, false),
    ).toMatchObject({
      code: 'ENROLLMENT_PERIOD_OVERLAP',
      message: expect.stringContaining('sin fecha de fin'),
      details: { enrollmentId: id, endDate: null },
    });
  });

  it('al reactivar pide reactivar la inscripción más reciente', () => {
    expect(
      samePeriodEnrollmentError(
        { id, startDate: day('2026-10-15'), endDate: day('2026-10-20') },
        true,
      ),
    ).toMatchObject({
      code: 'ENROLLMENT_REACTIVATION_SUPERSEDED',
      message: expect.stringContaining('desde el 15/10/2026'),
    });
  });
});
