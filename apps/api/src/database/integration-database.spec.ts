import { describe, expect, it } from 'vitest';
import { integrationDatabaseName, isIntegrationDatabaseAllowed } from './integration-database';

describe('integration database guard', () => {
  it('only allows dedicated test databases by default', () => {
    expect(
      isIntegrationDatabaseAllowed(
        'postgresql://academy_ci:academy_ci@localhost:5432/academy_ci?schema=public',
        undefined,
      ),
    ).toBe(true);
    expect(
      isIntegrationDatabaseAllowed('postgresql://academy:x@localhost:5432/academy_test', undefined),
    ).toBe(true);
    expect(
      isIntegrationDatabaseAllowed('postgresql://academy:x@localhost:5432/academy', undefined),
    ).toBe(false);
    expect(
      isIntegrationDatabaseAllowed(
        'postgresql://owner:x@ep-example.neon.tech/neondb?sslmode=require',
        undefined,
      ),
    ).toBe(false);
  });

  it('requires an explicit opt-in for any other database', () => {
    expect(
      isIntegrationDatabaseAllowed('postgresql://owner:x@ep-example.neon.tech/neondb', 'true'),
    ).toBe(true);
    expect(isIntegrationDatabaseAllowed(undefined, 'true')).toBe(false);
  });

  it('reads the database name without exposing credentials', () => {
    expect(integrationDatabaseName('postgresql://u:secret@host:5432/neondb?sslmode=require')).toBe(
      'neondb',
    );
    expect(integrationDatabaseName('not a url')).toBeNull();
  });
});
