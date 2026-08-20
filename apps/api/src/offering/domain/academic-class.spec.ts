import { describe, expect, it } from 'vitest';
import { validateClass } from './academic-class';
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
});
