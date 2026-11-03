import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261103220000_collection_closings/migration.sql', import.meta.url),
  'utf8',
);

describe('Cierres semanales y mensuales', () => {
  it('guardan la foto del período, uno por tipo y fecha de inicio', () => {
    expect(migration).toContain(`CREATE TYPE "ClosingKind" AS ENUM ('WEEKLY', 'MONTHLY')`);
    expect(migration).toContain('"snapshot" JSONB NOT NULL');
    expect(migration).toContain('"collection_closings_kind_from_date_key"');
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });
});
