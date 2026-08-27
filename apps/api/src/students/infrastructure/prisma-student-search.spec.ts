import { describe, expect, it } from 'vitest';
import { buildStudentSearchWhere } from './prisma-student-search';

describe('shared student search semantics', () => {
  it.each(['Ana', 'Paz'])('busca %s indistintamente por nombre o apellido', (query) => {
    const where = buildStudentSearchWhere(query);
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
      ]),
    );
  });

  it('combina todos los términos para buscar nombre completo', () => {
    const where = buildStudentSearchWhere('Ana María Paz');
    expect(where.OR).toEqual(
      expect.arrayContaining([
        {
          AND: ['Ana', 'María', 'Paz'].map((term) => ({
            OR: [
              { firstName: { contains: term, mode: 'insensitive' } },
              { lastName: { contains: term, mode: 'insensitive' } },
            ],
          })),
        },
      ]),
    );
  });

  it('normaliza puntos y separadores para buscar DNI', () => {
    const where = buildStudentSearchWhere('40.123.456');
    expect(where.OR).toEqual(expect.arrayContaining([{ dni: { contains: '40123456' } }]));
  });
});
