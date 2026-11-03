import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261103180000_card_surcharge_link/migration.sql', import.meta.url),
  'utf8',
);

describe('Recargo por tarjeta ligado a su cobro', () => {
  it('solo un recargo apunta a un cobro, y a uno solo', () => {
    expect(migration).toContain('"payments_surcharge_of_id_key"');
    expect(migration).toContain(`"surcharge_of_id" IS NULL OR "concept" = 'CARD_SURCHARGE'`);
    expect(migration).not.toMatch(/^\s*(UPDATE|DELETE FROM)\b/im);
  });
});
