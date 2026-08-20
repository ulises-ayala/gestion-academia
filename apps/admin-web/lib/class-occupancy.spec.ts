import { describe, expect, it } from 'vitest';
import { resolveClassOccupancy } from './class-occupancy';

describe('class occupancy', () => {
  it('usa el conteo global y no la cantidad de elementos de la pÃ¡gina', () => {
    expect(resolveClassOccupancy(140, 25)).toBe(140);
  });

  it('usa el total paginado como respaldo', () => {
    expect(resolveClassOccupancy(undefined, 140)).toBe(140);
  });
});
