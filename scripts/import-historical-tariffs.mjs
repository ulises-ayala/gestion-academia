import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';

loadEnvFile('.env');

/* =========================================================
 * CONFIGURACIÓN
 * ========================================================= */

const API_BASE_URL =
  process.env.API_BASE_URL ??
  'http://localhost:3001/api/v1';

const ADMIN_USERNAME =
  process.env.IMPORT_ADMIN_USERNAME;

const ADMIN_PASSWORD =
  process.env.IMPORT_ADMIN_PASSWORD;

const INPUT_FILE = path.resolve(
  './exports/historical-tariffs-ready.json',
);

const OUTPUT_DIR = path.resolve(
  './exports',
);

const REPORT_FILE = path.join(
  OUTPUT_DIR,
  'import-historical-tariffs-report.json',
);

/*
 * Por seguridad:
 *
 * node scripts/import-historical-tariffs.mjs
 *   => DRY RUN
 *
 * node scripts/import-historical-tariffs.mjs --apply
 *   => escribe en la BDD
 */
const APPLY =
  process.argv.includes('--apply');

/*
 * Una tarifa cuya vigencia ya terminó se crea
 * y luego se deja INACTIVE.
 *
 * Una tarifa sin validTo, o todavía vigente,
 * queda ACTIVE.
 */
const TODAY =
  new Date()
    .toISOString()
    .slice(0, 10);

/* =========================================================
 * HELPERS
 * ========================================================= */

function normalizeAmount(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return null;
  }

  return number.toFixed(2);
}

function normalizeNullableDate(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  return String(value)
    .trim()
    .slice(0, 10);
}

function normalizeText(value) {
  return String(value ?? '')
    .trim();
}

function tariffKey(tariff) {
  return [
    tariff.classId,
    normalizeAmount(
      tariff.amount,
    ),
    tariff.validFrom,
    tariff.validTo ?? '',
  ].join('|');
}

function expectedStatus(tariff) {
  if (
    tariff.validTo &&
    tariff.validTo < TODAY
  ) {
    return 'INACTIVE';
  }

  return 'ACTIVE';
}

/* =========================================================
 * VALIDACIÓN DEL ARCHIVO
 * ========================================================= */

function validateTariff(
  tariff,
  index,
) {
  const errors = [];

  if (!tariff.classId) {
    errors.push(
      'MISSING_CLASS_ID',
    );
  }

  if (!tariff.className) {
    errors.push(
      'MISSING_CLASS_NAME',
    );
  }

  if (!tariff.name) {
    errors.push(
      'MISSING_NAME',
    );
  }

  const amount =
    normalizeAmount(
      tariff.amount,
    );

  if (!amount) {
    errors.push(
      'INVALID_AMOUNT',
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      tariff.validFrom ?? '',
    )
  ) {
    errors.push(
      'INVALID_VALID_FROM',
    );
  }

  if (
    tariff.validTo &&
    !/^\d{4}-\d{2}-\d{2}$/.test(
      tariff.validTo,
    )
  ) {
    errors.push(
      'INVALID_VALID_TO',
    );
  }

  if (
    tariff.validFrom &&
    tariff.validTo &&
    tariff.validTo <
      tariff.validFrom
  ) {
    errors.push(
      'VALID_TO_BEFORE_VALID_FROM',
    );
  }

  if (
    normalizeText(
      tariff.name,
    ).length > 120
  ) {
    errors.push(
      'NAME_TOO_LONG',
    );
  }

  return {
    index:
      index + 1,

    classId:
      tariff.classId ?? null,

    className:
      tariff.className ?? null,

    name:
      tariff.name ?? null,

    amount,

    validFrom:
      tariff.validFrom ?? null,

    validTo:
      normalizeNullableDate(
        tariff.validTo,
      ),

    errors,
  };
}

/* =========================================================
 * LECTURA
 * ========================================================= */

async function readInput() {
  const raw =
    await fs.readFile(
      INPUT_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(raw);

  if (
    !parsed ||
    !Array.isArray(
      parsed.tariffs,
    )
  ) {
    throw new Error(
      'El archivo historical-tariffs-ready.json no contiene un array "tariffs".',
    );
  }

  return parsed;
}

/* =========================================================
 * AUTENTICACIÓN
 * ========================================================= */

async function login() {
  if (
    !ADMIN_USERNAME ||
    !ADMIN_PASSWORD
  ) {
    throw new Error(
      'Faltan IMPORT_ADMIN_USERNAME o IMPORT_ADMIN_PASSWORD en .env',
    );
  }

  const response =
    await fetch(
      `${API_BASE_URL}/auth/login`,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            username:
              ADMIN_USERNAME,

            password:
              ADMIN_PASSWORD,
          }),
      },
    );

  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `Login falló (${response.status}): ${body}`,
    );
  }

  const setCookie =
    response.headers.get(
      'set-cookie',
    );

  if (!setCookie) {
    throw new Error(
      'La API no devolvió cookie de sesión.',
    );
  }

  return setCookie
    .split(';')[0];
}

/* =========================================================
 * API
 * ========================================================= */

async function apiJson(
  url,
  options = {},
  sessionCookie,
) {
  const response =
    await fetch(
      `${API_BASE_URL}${url}`,
      {
        ...options,

        headers: {
          ...(options.body
            ? {
                'Content-Type':
                  'application/json',
              }
            : {}),

          ...(sessionCookie
            ? {
                Cookie:
                  sessionCookie,
              }
            : {}),

          ...(options.headers ?? {}),
        },
      },
    );

  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `${options.method ?? 'GET'} ${url} → ${response.status}: ${body}`,
    );
  }

  if (
    response.status === 204
  ) {
    return null;
  }

  const text =
    await response.text();

  if (!text) {
    return null;
  }

  return JSON.parse(text);
}

async function fetchExistingTariffs(
  sessionCookie,
) {
  const tariffs =
    await apiJson(
      '/tariffs',
      {},
      sessionCookie,
    );

  if (!Array.isArray(tariffs)) {
    throw new Error(
      'GET /tariffs no devolvió un array.',
    );
  }

  return tariffs;
}

async function fetchClasses(
  sessionCookie,
) {
  const response =
    await apiJson(
      '/classes?page=1&pageSize=100',
      {},
      sessionCookie,
    );

  /*
   * Tu endpoint de clases devuelve PageDto.
   */
  if (
    !response ||
    !Array.isArray(
      response.items,
    )
  ) {
    throw new Error(
      'GET /classes no devolvió un listado paginado válido.',
    );
  }

  return response.items;
}

async function createTariff(
  tariff,
  sessionCookie,
) {
  return apiJson(
    '/tariffs',
    {
      method:
        'POST',

      body:
        JSON.stringify({
          classId:
            tariff.classId,

          name:
            tariff.name,

          amount:
            tariff.amount,

          validFrom:
            tariff.validFrom,

          validTo:
            tariff.validTo,
        }),
    },
    sessionCookie,
  );
}

async function deactivateTariff(
  tariffId,
  sessionCookie,
) {
  return apiJson(
    `/tariffs/${tariffId}`,
    {
      method:
        'DELETE',
    },
    sessionCookie,
  );
}

/* =========================================================
 * PROCESAMIENTO
 * ========================================================= */

async function main() {
  console.log('');
  console.log(
    '=========================================================',
  );

  console.log(
    ' IMPORTACIÓN DE TARIFAS HISTÓRICAS',
  );

  console.log(
    '=========================================================',
  );

  console.log('');

  console.log(
    `📄 Archivo: ${INPUT_FILE}`,
  );

  console.log(
    `🧪 Modo: ${
      APPLY
        ? 'APPLY'
        : 'DRY RUN'
    }`,
  );

  console.log('');

  /* -------------------------------------------------------
   * 1. Leer archivo final
   * ------------------------------------------------------- */

  const input =
    await readInput();

  const sourceTariffs =
    input.tariffs;

  console.log(
    `📊 Tarifas encontradas en archivo: ${sourceTariffs.length}`,
  );

  /* -------------------------------------------------------
   * 2. Validación local
   * ------------------------------------------------------- */

  const validation =
    sourceTariffs.map(
      validateTariff,
    );

  const invalid =
    validation.filter(
      (item) =>
        item.errors.length > 0,
    );

  if (
    invalid.length > 0
  ) {
    console.log('');
    console.log(
      `❌ Tarifas inválidas: ${invalid.length}`,
    );

    for (
      const item
      of invalid
    ) {
      console.log(
        `  - #${item.index} ${item.className ?? '(sin clase)'}: ${item.errors.join(', ')}`,
      );
    }

    throw new Error(
      'La importación fue cancelada porque el archivo contiene tarifas inválidas.',
    );
  }

  console.log(
    '✅ Validación del archivo correcta.',
  );

  /* -------------------------------------------------------
   * 3. Detectar duplicados dentro del propio archivo
   * ------------------------------------------------------- */

  const sourceKeys =
    new Map();

  const duplicateSource = [];

  for (
    const tariff
    of sourceTariffs
  ) {
    const normalized = {
      ...tariff,

      amount:
        normalizeAmount(
          tariff.amount,
        ),

      validTo:
        normalizeNullableDate(
          tariff.validTo,
        ),
    };

    const key =
      tariffKey(
        normalized,
      );

    if (
      sourceKeys.has(key)
    ) {
      duplicateSource.push({
        key,

        first:
          sourceKeys.get(
            key,
          ),

        duplicate:
          normalized,
      });

      continue;
    }

    sourceKeys.set(
      key,
      normalized,
    );
  }

  if (
    duplicateSource.length >
    0
  ) {
    console.log('');
    console.log(
      `❌ Duplicados dentro del JSON: ${duplicateSource.length}`,
    );

    for (
      const duplicate
      of duplicateSource
    ) {
      console.log(
        `  - ${duplicate.duplicate.className} | ${duplicate.duplicate.amount} | ${duplicate.duplicate.validFrom} → ${duplicate.duplicate.validTo ?? 'sin fin'}`,
      );
    }

    throw new Error(
      'La importación fue cancelada porque historical-tariffs-ready.json contiene duplicados.',
    );
  }

  console.log(
    '✅ No hay duplicados internos.',
  );

  /* -------------------------------------------------------
   * DRY RUN necesita consultar la API también.
   *
   * No escribe nada, pero necesitamos saber:
   * - si las clases existen
   * - si las tarifas ya existen
   * ------------------------------------------------------- */

  console.log('');
  console.log(
    '🔐 Iniciando sesión...',
  );

  const sessionCookie =
    await login();

  console.log(
    '✅ Sesión iniciada.',
  );

  /* -------------------------------------------------------
   * 4. Validar classId contra catálogo real
   * ------------------------------------------------------- */

  const classes =
    await fetchClasses(
      sessionCookie,
    );

  const classesById =
    new Map(
      classes.map(
        (item) => [
          item.id,
          item,
        ],
      ),
    );

  console.log(
    `💃 Clases disponibles en API: ${classes.length}`,
  );

  const missingClasses =
    sourceTariffs.filter(
      (tariff) =>
        !classesById.has(
          tariff.classId,
        ),
    );

  if (
    missingClasses.length >
    0
  ) {
    console.log('');
    console.log(
      `❌ classId inexistentes: ${missingClasses.length}`,
    );

    for (
      const tariff
      of missingClasses
    ) {
      console.log(
        `  - ${tariff.className} | ${tariff.classId}`,
      );
    }

    throw new Error(
      'La importación fue cancelada porque algunas tarifas apuntan a clases inexistentes.',
    );
  }

  console.log(
    '✅ Todos los classId existen.',
  );

  /* -------------------------------------------------------
   * 5. Tarifas ya existentes
   * ------------------------------------------------------- */

  const existingTariffs =
    await fetchExistingTariffs(
      sessionCookie,
    );

  console.log(
    `💰 Tarifas actualmente en BDD: ${existingTariffs.length}`,
  );

  const existingByKey =
    new Map();

  for (
    const tariff
    of existingTariffs
  ) {
    const key =
      tariffKey({
        classId:
          tariff.classId,

        amount:
          normalizeAmount(
            tariff.amount,
          ),

        validFrom:
          tariff.validFrom,

        validTo:
          normalizeNullableDate(
            tariff.validTo,
          ),
      });

    existingByKey.set(
      key,
      tariff,
    );
  }

  /* -------------------------------------------------------
   * 6. Crear plan
   * ------------------------------------------------------- */

  const report = [];

  for (
    const source
    of sourceTariffs
  ) {
    const tariff = {
      classId:
        source.classId,

      className:
        source.className,

      name:
        normalizeText(
          source.name,
        ),

      amount:
        normalizeAmount(
          source.amount,
        ),

      validFrom:
        source.validFrom,

      validTo:
        normalizeNullableDate(
          source.validTo,
        ),
    };

    const expected =
      expectedStatus(
        tariff,
      );

    const key =
      tariffKey(
        tariff,
      );

    const existing =
      existingByKey.get(
        key,
      );

    if (existing) {
      report.push({
        ...tariff,

        result:
          'ALREADY_EXISTS',

        existingTariffId:
          existing.id,

        existingStatus:
          existing.status,

        expectedStatus:
          expected,
      });

      continue;
    }

    report.push({
      ...tariff,

      result:
        APPLY
          ? 'PENDING_CREATE'
          : 'WOULD_CREATE',

      existingTariffId:
        null,

      existingStatus:
        null,

      expectedStatus:
        expected,
    });
  }

  /* -------------------------------------------------------
   * 7. Aplicar
   * ------------------------------------------------------- */

  if (APPLY) {
    console.log('');
    console.log(
      '🚀 Importando tarifas...',
    );

    for (
      const item
      of report
    ) {
      if (
        item.result !==
        'PENDING_CREATE'
      ) {
        continue;
      }

      try {
        console.log(
          `📤 ${item.className} | $${item.amount} | ${item.validFrom} → ${item.validTo ?? 'sin fin'}`,
        );

        const created =
          await createTariff(
            item,
            sessionCookie,
          );

        item.createdTariffId =
          created.id;

        /*
         * POST /tariffs crea ACTIVE.
         *
         * Si el período histórico ya terminó,
         * la dejamos INACTIVE.
         */
        if (
          item.expectedStatus ===
          'INACTIVE'
        ) {
          await deactivateTariff(
            created.id,
            sessionCookie,
          );

          item.result =
            'CREATED_INACTIVE';
        } else {
          item.result =
            'CREATED_ACTIVE';
        }

        /*
         * Esto hace que si dentro de esta misma ejecución
         * apareciera luego la misma tarifa, ya se considere
         * existente.
         */
        existingByKey.set(
          tariffKey(
            item,
          ),
          {
            ...created,
            status:
              item.expectedStatus,
          },
        );
      } catch (error) {
        item.result =
          'ERROR';

        item.error =
          error instanceof Error
            ? error.message
            : String(error);

        console.error(
          `❌ ${item.className}: ${item.error}`,
        );
      }
    }
  }

  /* -------------------------------------------------------
   * 8. Resumen
   * ------------------------------------------------------- */

  const count =
    (result) =>
      report.filter(
        (item) =>
          item.result ===
          result,
      ).length;

  const alreadyExists =
    count(
      'ALREADY_EXISTS',
    );

  const wouldCreate =
    count(
      'WOULD_CREATE',
    );

  const createdActive =
    count(
      'CREATED_ACTIVE',
    );

  const createdInactive =
    count(
      'CREATED_INACTIVE',
    );

  const errors =
    count(
      'ERROR',
    );

  console.log('');
  console.log(
    '=========================================================',
  );

  console.log(
    ' RESULTADO',
  );

  console.log(
    '=========================================================',
  );

  console.log(
    `📊 Tarifas fuente: ${sourceTariffs.length}`,
  );

  console.log(
    `↩️ Ya existentes: ${alreadyExists}`,
  );

  if (!APPLY) {
    console.log(
      `🧪 Se crearían: ${wouldCreate}`,
    );
  } else {
    console.log(
      `✅ Creadas ACTIVE: ${createdActive}`,
    );

    console.log(
      `📚 Creadas INACTIVE: ${createdInactive}`,
    );

    console.log(
      `❌ Errores: ${errors}`,
    );
  }

  /* -------------------------------------------------------
   * 9. Reporte
   * ------------------------------------------------------- */

  await fs.mkdir(
    OUTPUT_DIR,
    {
      recursive:
        true,
    },
  );

  const output = {
    generatedAt:
      new Date()
        .toISOString(),

    mode:
      APPLY
        ? 'APPLY'
        : 'DRY_RUN',

    source:
      INPUT_FILE,

    today:
      TODAY,

    summary: {
      sourceTariffs:
        sourceTariffs.length,

      classesChecked:
        classes.length,

      databaseTariffsBefore:
        existingTariffs.length,

      alreadyExists,

      wouldCreate,

      createdActive,

      createdInactive,

      errors,
    },

    items:
      report,
  };

  await fs.writeFile(
    REPORT_FILE,
    JSON.stringify(
      output,
      null,
      2,
    ),
    'utf8',
  );

  console.log('');
  console.log(
    `📝 Reporte: ${REPORT_FILE}`,
  );

  if (
    APPLY &&
    errors > 0
  ) {
    throw new Error(
      `La importación terminó con ${errors} error(es). Revisá el reporte.`,
    );
  }

  console.log('');

  if (APPLY) {
    console.log(
      '✅ Importación finalizada.',
    );
  } else {
    console.log(
      '✅ Dry run finalizado. No se modificó la BDD.',
    );

    console.log('');
    console.log(
      'Para aplicar:',
    );

    console.log(
      'node scripts/import-historical-tariffs.mjs --apply',
    );
  }

  console.log('');
}

main().catch(
  (error) => {
    console.error('');
    console.error(
      '❌ ERROR:',
    );

    console.error(
      error instanceof Error
        ? error.message
        : error,
    );

    process.exitCode =
      1;
  },
);