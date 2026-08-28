import { validatePassword } from '../../../../apps/api/src/auth/domain/password';

export type SeedEnvironment = Readonly<Record<string, string | undefined>>;

const databaseNameFrom = (rawUrl: string, label: string) => {
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(rawUrl);
  } catch {
    throw new Error(`${label}: DATABASE_URL no es una URL válida.`);
  }
  if (databaseUrl.protocol !== 'postgresql:' && databaseUrl.protocol !== 'postgres:') {
    throw new Error(`${label}: DATABASE_URL debe utilizar PostgreSQL.`);
  }
  return {
    databaseName: decodeURIComponent(databaseUrl.pathname.replace(/^\//, '')),
    hostname: databaseUrl.hostname,
  };
};

export const assertDevelopmentSeedEnvironment = (env: SeedEnvironment) => {
  const label = 'Seed de desarrollo cancelado';
  if (env.NODE_ENV !== 'development')
    throw new Error(`${label}: NODE_ENV debe ser exactamente "development".`);
  if (env.CI) throw new Error(`${label}: no se permite ejecutar en CI.`);
  if (!env.DATABASE_URL) throw new Error(`${label}: falta DATABASE_URL.`);

  const { databaseName, hostname } = databaseNameFrom(env.DATABASE_URL, label);
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (!localHosts.has(hostname) || databaseName !== 'academy')
    throw new Error(
      `${label}: sólo se permite PostgreSQL local (localhost/127.0.0.1/::1), base "academy".`,
    );
};

export const assertStagingSeedEnvironment = (env: SeedEnvironment): string => {
  const label = 'Seed de staging cancelado';
  if (env.NODE_ENV !== 'production')
    throw new Error(`${label}: NODE_ENV debe ser exactamente "production".`);
  if (env.CI) throw new Error(`${label}: no se permite ejecutar en CI.`);
  if (env.ALLOW_STAGING_SEED !== 'true')
    throw new Error(`${label}: ALLOW_STAGING_SEED debe ser exactamente "true".`);
  if (env.STAGING_SEED_TARGET !== 'academy_staging')
    throw new Error(`${label}: STAGING_SEED_TARGET debe ser exactamente "academy_staging".`);
  if (env.STAGING_SEED_CONFIRM !== 'SEED_ACADEMY_STAGING')
    throw new Error(`${label}: STAGING_SEED_CONFIRM debe ser exactamente "SEED_ACADEMY_STAGING".`);
  if (!env.DATABASE_URL) throw new Error(`${label}: falta DATABASE_URL.`);
  const { databaseName } = databaseNameFrom(env.DATABASE_URL, label);
  if (databaseName !== 'academy_staging')
    throw new Error(`${label}: DATABASE_URL debe apuntar exactamente a "academy_staging".`);
  if (!env.STAGING_SEED_PASSWORD) throw new Error(`${label}: falta STAGING_SEED_PASSWORD.`);

  return validatePassword(env.STAGING_SEED_PASSWORD);
};
