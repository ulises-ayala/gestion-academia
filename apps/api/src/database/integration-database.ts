/**
 * Los tests de integración crean usuarios, alumnos, cuotas y pagos de prueba. Sólo corren contra
 * bases dedicadas a tests (`academy_ci` o un nombre terminado en `_test`) para que nunca escriban
 * en la base de desarrollo, staging o producción por tener un `DATABASE_URL` cargado.
 * Para otra base descartable, habilitarlos explícitamente con
 * `INTEGRATION_TESTS_ALLOW_ANY_DATABASE=true`.
 */
const testDatabaseName = /^(?:academy_ci|[a-z0-9_]+_test)$/i;

export const integrationDatabaseName = (url: string | undefined) => {
  if (!url) return null;
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, '')) || null;
  } catch {
    return null;
  }
};

export const isIntegrationDatabaseAllowed = (
  url: string | undefined,
  allowAny: string | undefined,
) => {
  if (!url) return false;
  if (allowAny === 'true') return true;
  const name = integrationDatabaseName(url);
  return name !== null && testDatabaseName.test(name);
};

export const integrationDatabaseEnabled = isIntegrationDatabaseAllowed(
  process.env.DATABASE_URL,
  process.env.INTEGRATION_TESTS_ALLOW_ANY_DATABASE,
);

if (process.env.DATABASE_URL && !integrationDatabaseEnabled && !process.env.CI)
  console.warn(
    `[tests] Se omiten los tests de integración: la base "${integrationDatabaseName(process.env.DATABASE_URL) ?? '?'}" no es una base de tests (academy_ci o *_test).`,
  );
