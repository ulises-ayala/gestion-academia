import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('reports CSV', () => {
  it('exporta UTF-8, encabezados, decimales exactos y escapa texto', () => {
    const csv = toCsv(
      ['Alumno', 'Monto'],
      [
        ['Pérez, Ana', '50000.00'],
        ['Texto con "comillas"\ny salto', '0.10'],
      ],
    );
    expect(csv.startsWith('\uFEFFAlumno,Monto\r\n')).toBe(true);
    expect(csv).toContain('"Pérez, Ana",50000.00');
    expect(csv).toContain('"Texto con ""comillas""\ny salto",0.10');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});
