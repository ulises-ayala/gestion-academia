import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const core = readFileSync(
  new URL('./20260830200000_payments_v2_core/migration.sql', import.meta.url),
  'utf8',
);
const defaultCleanup = readFileSync(
  new URL('./20260830233411_payments_v2_tender_id_default/migration.sql', import.meta.url),
  'utf8',
);

describe('Payments v2 core migrations', () => {
  it('adds PARTIAL and backfills one tender before dropping the v1 source column', () => {
    expect(core).toContain('ALTER TYPE "MonthlyChargeStatus" ADD VALUE \'PARTIAL\'');
    expect(core.indexOf('CREATE TABLE "payment_tenders"')).toBeLessThan(
      core.indexOf('INSERT INTO "payment_tenders"'),
    );
    expect(core).toContain('SELECT "id", "payment_method", "amount", "created_at"');
    expect(core.indexOf('INSERT INTO "payment_tenders"')).toBeLessThan(
      core.indexOf('DROP COLUMN "payment_method"'),
    );
    expect(core).not.toMatch(/DELETE\s+FROM\s+"?payment_allocations"?/i);
  });

  it('keeps Prisma as the UUID source after the SQL backfill', () => {
    expect(defaultCleanup).toContain(
      'ALTER TABLE "public"."payment_tenders" ALTER COLUMN "id" DROP DEFAULT',
    );
  });
});
