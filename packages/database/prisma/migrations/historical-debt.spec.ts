import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261028150000_historical_debt/migration.sql', import.meta.url),
  'utf8',
);

describe('Deuda histórica', () => {
  it('distingue cuota mensual (con tarifa) de deuda histórica (con detalle y sin tarifa)', () => {
    expect(migration).toContain(
      `CREATE TYPE "MonthlyChargeKind" AS ENUM ('MONTHLY', 'HISTORICAL_DEBT')`,
    );
    expect(migration).toContain(`"kind" "MonthlyChargeKind" NOT NULL DEFAULT 'MONTHLY'`);
    expect(migration).toMatch(/monthly_charges_kind_check[\s\S]*"tariff_id" IS NOT NULL/);
  });

  it('mantiene una cuota mensual por inscripción y mes', () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "monthly_charges_enrollment_id_period_key"[\s\S]*WHERE "kind" = 'MONTHLY'/,
    );
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });
});
