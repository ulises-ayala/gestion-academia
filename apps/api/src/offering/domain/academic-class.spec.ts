import { describe, expect, it } from 'vitest';
import { assertClassCanBeRemoved, validateClass } from './academic-class';
const base = {
  name: 'Bachata Inicial',
  danceTypeId: crypto.randomUUID(),
  teacherId: crypto.randomUUID(),
  capacity: 20,
};
describe('academic class invariants', () => {
  it('acepta múltiples horarios y horarios contiguos', () => {
    expect(
      validateClass({
        ...base,
        schedules: [
          {
            dayOfWeek: 'TUESDAY',
            startTime: '20:00',
            endTime: '21:00',
            roomId: crypto.randomUUID(),
          },
          {
            dayOfWeek: 'TUESDAY',
            startTime: '21:00',
            endTime: '22:00',
            roomId: crypto.randomUUID(),
          },
        ],
      }).schedules,
    ).toHaveLength(2);
  });
  it('rechaza fin anterior o igual al inicio', () => {
    expect(() =>
      validateClass({
        ...base,
        schedules: [
          {
            dayOfWeek: 'TUESDAY',
            startTime: '20:00',
            endTime: '20:00',
            roomId: crypto.randomUUID(),
          },
        ],
      }),
    ).toThrow('posterior');
  });
  it('rechaza cupo no positivo', () => {
    expect(() =>
      validateClass({
        ...base,
        capacity: 0,
        schedules: [
          {
            dayOfWeek: 'TUESDAY',
            startTime: '20:00',
            endTime: '21:00',
            roomId: crypto.randomUUID(),
          },
        ],
      }),
    ).toThrow('entero positivo');
  });
  it('rechaza horarios internos superpuestos para el profesor', () => {
    expect(() =>
      validateClass({
        ...base,
        schedules: [
          {
            dayOfWeek: 'TUESDAY',
            startTime: '20:00',
            endTime: '21:00',
            roomId: crypto.randomUUID(),
          },
          {
            dayOfWeek: 'TUESDAY',
            startTime: '20:30',
            endTime: '21:30',
            roomId: crypto.randomUUID(),
          },
        ],
      }),
    ).toThrow('superponen');
  });
  it('normaliza profesores adicionales y no repite al responsable', () => {
    const schedules = [
      { dayOfWeek: 'MONDAY' as const, startTime: '18:00', endTime: '19:00', roomId: 'r1' },
    ];
    const sofia = crypto.randomUUID();
    expect(validateClass({ ...base, schedules }).additionalTeacherIds).toEqual([]);
    expect(
      validateClass({ ...base, schedules, additionalTeacherIds: [sofia, ` ${sofia} `] })
        .additionalTeacherIds,
    ).toEqual([sofia]);
    expect(() =>
      validateClass({ ...base, schedules, additionalTeacherIds: [base.teacherId] }),
    ).toThrow('El profesor responsable no puede figurar también como adicional');
    expect(() =>
      validateClass({
        ...base,
        schedules,
        additionalTeacherIds: Array.from({ length: 11 }, () => crypto.randomUUID()),
      }),
    ).toThrow('hasta 10 profesores adicionales');
  });
});

describe('borrar una clase de prueba', () => {
  it('solo se borra sin inscripciones, cobros ni clases de prueba', () => {
    expect(() =>
      assertClassCanBeRemoved({ enrollments: 0, payments: 0, trialClasses: 0 }),
    ).not.toThrow();
    expect(() => assertClassCanBeRemoved({ enrollments: 2, payments: 1, trialClasses: 0 })).toThrow(
      'La clase tiene registros (2 inscripción(es), 1 cobro(s)): no se puede borrar. Desactivala para archivarla sin perder su historial.',
    );
  });
});
