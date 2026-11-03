import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261103200000_payment_concepts/migration.sql', import.meta.url),
  'utf8',
);

describe('Catálogo de conceptos de cobro', () => {
  it('crea los conceptos de la PO y pasa los cobros existentes al catálogo', () => {
    expect(migration).toContain('CREATE TABLE "payment_concepts"');
    for (const name of [
      'Formaciones docentes',
      'Inscripciones',
      'Workshops y talleres',
      'Indumentaria',
      'Entradas o precintos de la Gala',
      'Otros',
    ])
      expect(migration).toContain(`'${name}'`);
    expect(migration).toContain(`WHERE "concept" = 'APPAREL'`);
    expect(migration).toContain(`WHERE "concept" = 'GALA_SEAL'`);
    expect(migration).toContain(`(("concept" = 'OTHER') = ("concept_id" IS NOT NULL))`);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });
});
