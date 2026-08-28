import { describe, expect, it } from 'vitest';
import {
  assertDevelopmentSeedEnvironment,
  assertStagingSeedEnvironment,
  type SeedEnvironment,
} from './safety';

const validEnvironment: SeedEnvironment = {
  NODE_ENV: 'production',
  ALLOW_STAGING_SEED: 'true',
  STAGING_SEED_TARGET: 'academy_staging',
  STAGING_SEED_CONFIRM: 'SEED_ACADEMY_STAGING',
  DATABASE_URL: 'postgresql://user:secret@example.test:5432/academy_staging?schema=public',
  STAGING_SEED_PASSWORD: 'UnaClaveSegura2026!',
};

describe('staging seed safety', () => {
  it('acepta únicamente el entorno explícito de academy_staging', () => {
    expect(assertStagingSeedEnvironment(validEnvironment)).toBe('UnaClaveSegura2026!');
  });

  it.each([
    ['NODE_ENV de desarrollo', { NODE_ENV: 'development' }],
    ['ALLOW_STAGING_SEED faltante', { ALLOW_STAGING_SEED: undefined }],
    ['ALLOW_STAGING_SEED aproximado', { ALLOW_STAGING_SEED: 'TRUE' }],
    ['target incorrecto', { STAGING_SEED_TARGET: 'academy' }],
    ['confirmación incorrecta', { STAGING_SEED_CONFIRM: 'academy_staging' }],
    ['DATABASE_URL faltante', { DATABASE_URL: undefined }],
    ['protocolo no PostgreSQL', { DATABASE_URL: 'mysql://host/academy_staging' }],
    ['base local', { DATABASE_URL: 'postgresql://host/academy' }],
    ['base productiva', { DATABASE_URL: 'postgresql://host/academy_prod' }],
    ['base production', { DATABASE_URL: 'postgresql://host/production' }],
    ['base parecida', { DATABASE_URL: 'postgresql://host/academy_staging_backup' }],
    ['password faltante', { STAGING_SEED_PASSWORD: undefined }],
    ['password inválida', { STAGING_SEED_PASSWORD: 'corta' }],
  ])('rechaza %s', (_label, patch) => {
    expect(() => assertStagingSeedEnvironment({ ...validEnvironment, ...patch })).toThrow();
  });
});

describe('development seed safety', () => {
  const validDevelopment = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://academy:academy@localhost:5432/academy',
  };

  it('conserva el destino local academy', () =>
    expect(() => assertDevelopmentSeedEnvironment(validDevelopment)).not.toThrow());

  it.each([
    ['NODE_ENV', { NODE_ENV: 'production' }],
    ['CI', { CI: 'true' }],
    ['host remoto', { DATABASE_URL: 'postgresql://host/academy' }],
    ['base staging', { DATABASE_URL: 'postgresql://localhost/academy_staging' }],
  ])('rechaza %s', (_label, patch) =>
    expect(() => assertDevelopmentSeedEnvironment({ ...validDevelopment, ...patch })).toThrow(),
  );
});
