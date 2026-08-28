import { DayOfWeek } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { validateSeedDataset, type SeedDatasetSnapshot } from './dataset-validation';
import { students } from './seed-data';

const valid: SeedDatasetSnapshot = {
  studentDnis: ['1', '2'],
  classCapacities: [2, 2],
  schedules: [
    { classIndex: 0, dayOfWeek: DayOfWeek.MONDAY, startHour: 18, endHour: 19 },
    { classIndex: 1, dayOfWeek: DayOfWeek.MONDAY, startHour: 19, endHour: 20 },
  ],
  enrollments: [
    { studentIndex: 0, classIndex: 0, startOffset: -30, endOffset: null },
    { studentIndex: 0, classIndex: 1, startOffset: -20, endOffset: null },
  ],
  attendances: [{ enrollmentIndex: 0, dateOffset: -1 }],
  charges: [{ enrollmentIndex: 0, period: 'current' }],
};

describe('seed dataset validation', () => {
  it('conserva los 28 alumnos ficticios del escenario compartido', () =>
    expect(students).toHaveLength(28));

  it('acepta horarios contiguos', () => expect(() => validateSeedDataset(valid)).not.toThrow());

  it('rechaza DNI duplicado', () =>
    expect(() => validateSeedDataset({ ...valid, studentDnis: ['1', '1'] })).toThrow(/DNI/));

  it('rechaza superposición horaria coexistente', () =>
    expect(() =>
      validateSeedDataset({
        ...valid,
        schedules: [
          valid.schedules[0]!,
          { ...valid.schedules[1]!, startHour: 18.5, endHour: 19.5 },
        ],
      }),
    ).toThrow(/superpuestos/));

  it('rechaza cupo excedido', () =>
    expect(() => validateSeedDataset({ ...valid, classCapacities: [0, 2] })).toThrow());

  it('rechaza asistencia fuera de vigencia', () =>
    expect(() =>
      validateSeedDataset({ ...valid, attendances: [{ enrollmentIndex: 0, dateOffset: -31 }] }),
    ).toThrow(/vigencia/));

  it('rechaza asistencia y cuota duplicadas', () => {
    expect(() =>
      validateSeedDataset({
        ...valid,
        attendances: [valid.attendances[0]!, valid.attendances[0]!],
      }),
    ).toThrow(/asistencia duplicada/);
    expect(() =>
      validateSeedDataset({ ...valid, charges: [valid.charges[0]!, valid.charges[0]!] }),
    ).toThrow(/cuota mensual duplicada/);
  });
});
