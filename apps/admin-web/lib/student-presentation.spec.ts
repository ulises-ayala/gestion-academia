import { describe, expect, it } from 'vitest';
import { formatStudentName, formatStudentPhone } from './student-presentation';

describe('student presentation helpers', () => {
  it('formats names for reading without changing their source values', () => {
    expect(formatStudentName('DE LA CRUZ', 'MARÍA JOSÉ')).toBe('de la Cruz, María José');
    expect(formatStudentName('Gómez', 'Ana')).toBe('Gómez, Ana');
  });

  it('formats only recognisable Argentine mobile numbers', () => {
    expect(formatStudentPhone('5493704697300')).toBe('+54 9 3704 69-7300');
    expect(formatStudentPhone('3704-697')).toBe('3704-697');
  });
});
