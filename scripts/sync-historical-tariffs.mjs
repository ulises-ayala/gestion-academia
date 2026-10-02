import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';

loadEnvFile('.env');

/* =========================================================
 * CONFIG
 * ========================================================= */

const API_BASE_URL =
  process.env.API_BASE_URL ??
  'http://localhost:3001/api/v1';

const ADMIN_USERNAME =
  process.env.IMPORT_ADMIN_USERNAME;

const ADMIN_PASSWORD =
  process.env.IMPORT_ADMIN_PASSWORD;

const READY_FILE = path.resolve(
  './exports/historical-tariffs-ready.json',
);

const DIFF_FILE = path.resolve(
  './exports/historical-tariffs-db-diff.json',
);

const APPLY =
  process.argv.includes('--apply');

/*
 * Las tarifas históricas deben quedar INACTIVE.
 *
 * En la API actual:
 * DELETE /tariffs/:id
 * = desactivar tarifa
 *
 * DELETE /tariffs/:id/permanent
 * = eliminación física
 *
 * Este script NUNCA usa el endpoint permanent.
 */
const DEACTIVATE_CREATED_TARIFFS = true;

/* =========================================================
 * HELPERS
 * ========================================================= */

function normalizeAmount(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number.toFixed(2);
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  return String(value)
    .slice(0, 10);
}

function exactKey(tariff) {
  return [
    tariff.classId,
    normalizeAmount(tariff.amount),
    normalizeDate(tariff.validFrom),
    normalizeDate(tariff.validTo) ?? '',
  ].join('|');
}

function tariffLabel(tariff) {
  return (
    `${tariff.className ?? tariff.classId} | ` +
    `$${normalizeAmount(tariff.amount)} | ` +
    `${normalizeDate(tariff.validFrom)} → ` +
    `${normalizeDate(tariff.validTo) ?? 'null'}`
  );
}

function sameTariffState(
  actual,
  expected,
) {
  if (
    !actual ||
    !expected
  ) {
    return false;
  }

  return (
    actual.classId ===
      expected.classId &&

    normalizeAmount(actual.amount) ===
      normalizeAmount(expected.amount) &&

    normalizeDate(actual.validFrom) ===
      normalizeDate(expected.validFrom) &&

    normalizeDate(actual.validTo) ===
      normalizeDate(expected.validTo)
  );
}

function rangesOverlap(a, b) {
  const aStart =
    normalizeDate(a.validFrom);

  const aEnd =
    normalizeDate(a.validTo) ??
    '9999-12-31';

  const bStart =
    normalizeDate(b.validFrom);

  const bEnd =
    normalizeDate(b.validTo) ??
    '9999-12-31';

  if (
    !aStart ||
    !bStart
  ) {
    return false;
  }

  return (
    aStart <= bEnd &&
    bStart <= aEnd
  );
}

async function readJson(file) {
  const raw =
    await fs.readFile(
      file,
      'utf8',
    );

  return JSON.parse(raw);
}

function extractTariffFromResponse(value) {
  if (
    value &&
    typeof value === 'object'
  ) {
    if (
      value.id &&
      value.classId
    ) {
      return value;
    }

    if (
      value.data &&
      typeof value.data === 'object' &&
      value.data.id
    ) {
      return value.data;
    }

    if (
      value.tariff &&
      typeof value.tariff === 'object' &&
      value.tariff.id
    ) {
      return value.tariff;
    }
  }

  return null;
}

/* =========================================================
 * LOGIN / API
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
        method: 'POST',

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

async function apiRequest(
  method,
  url,
  sessionCookie,
  body = undefined,
) {
  const response =
    await fetch(
      `${API_BASE_URL}${url}`,
      {
        method,

        headers: {
          Cookie:
            sessionCookie,

          ...(body !== undefined
            ? {
                'Content-Type':
                  'application/json',
              }
            : {}),
        },

        ...(body !== undefined
          ? {
              body:
                JSON.stringify(
                  body,
                ),
            }
          : {}),
      },
    );

  const raw =
    await response.text();

  let parsed = null;

  if (raw) {
    try {
      parsed =
        JSON.parse(raw);
    } catch {
      parsed =
        raw;
    }
  }

  if (!response.ok) {
    throw new Error(
      `${method} ${url} → ${response.status}: ` +
      `${
        typeof parsed === 'string'
          ? parsed
          : JSON.stringify(parsed)
      }`,
    );
  }

  return parsed;
}

async function getTariffs(
  sessionCookie,
) {
  const response =
    await apiRequest(
      'GET',
      '/tariffs',
      sessionCookie,
    );

  if (!Array.isArray(response)) {
    throw new Error(
      'GET /tariffs no devolvió un array.',
    );
  }

  return response;
}

/* =========================================================
 * CARGA DE ARCHIVOS
 * ========================================================= */

async function loadReady() {
  const parsed =
    await readJson(
      READY_FILE,
    );

  const tariffs =
    Array.isArray(parsed)
      ? parsed
      : parsed.tariffs;

  if (!Array.isArray(tariffs)) {
    throw new Error(
      'historical-tariffs-ready.json no contiene tariffs.',
    );
  }

  return tariffs;
}

async function loadDiff() {
  const parsed =
    await readJson(
      DIFF_FILE,
    );

  if (
    !parsed ||
    !Array.isArray(
      parsed.diff,
    )
  ) {
    throw new Error(
      'historical-tariffs-db-diff.json no tiene el formato esperado.',
    );
  }

  return parsed;
}

/* =========================================================
 * VALIDACIÓN DEL DIFF
 * ========================================================= */

function validateDiffFile(
  diffFile,
  readyTariffs,
) {
  const summary =
    diffFile.summary ?? {};

  if (
    Number(
      summary.conflict ?? 0,
    ) !== 0
  ) {
    throw new Error(
      `El diff contiene ${summary.conflict} CONFLICT. No se puede sincronizar.`,
    );
  }

  if (
    Number(
      summary.obsolete ?? 0,
    ) !== 0
  ) {
    throw new Error(
      `El diff contiene ${summary.obsolete} OBSOLETE. No se puede sincronizar automáticamente.`,
    );
  }

  if (
    Number(
      summary.readyInternalOverlaps ?? 0,
    ) !== 0
  ) {
    throw new Error(
      'El dataset ready contiene solapamientos internos.',
    );
  }

  if (
    Number(
      summary.readyTariffCount,
    ) !==
    readyTariffs.length
  ) {
    throw new Error(
      'La cantidad de tarifas ready cambió desde que se generó el diff. Volvé a ejecutar compare-historical-tariffs-with-db.mjs.',
    );
  }

  const allowed =
    new Set([
      'UNCHANGED',
      'NEW',
      'UPDATE_RANGE',
    ]);

  const invalid =
    diffFile.diff.filter(
      (item) =>
        !allowed.has(
          item.result,
        ),
    );

  if (
    invalid.length > 0
  ) {
    throw new Error(
      `El diff contiene ${invalid.length} operaciones no permitidas.`,
    );
  }
}

/* =========================================================
 * VALIDACIÓN CONTRA BDD ACTUAL
 * ========================================================= */

function validateLiveDatabase(
  diffEntries,
  dbTariffs,
) {
  const byId =
    new Map(
      dbTariffs.map(
        (item) => [
          item.id,
          item,
        ],
      ),
    );

  const exactLive =
    new Map();

  for (
    const tariff
    of dbTariffs
  ) {
    const key =
      exactKey(
        tariff,
      );

    if (
      !exactLive.has(key)
    ) {
      exactLive.set(
        key,
        [],
      );
    }

    exactLive
      .get(key)
      .push(tariff);
  }

  const errors = [];
  const alreadyApplied = {
    updates: [],
    news: [],
  };

  /*
   * UNCHANGED:
   * debe seguir existiendo exactamente.
   */
  for (
    const entry
    of diffEntries.filter(
      (item) =>
        item.result ===
        'UNCHANGED',
    )
  ) {
    const matches =
      exactLive.get(
        exactKey(
          entry.readyTariff,
        ),
      ) ?? [];

    if (
      matches.length === 0
    ) {
      errors.push(
        `UNCHANGED ya no existe: ${tariffLabel(entry.readyTariff)}`,
      );
    }
  }

  /*
   * UPDATE_RANGE:
   *
   * Permitimos dos estados:
   *
   * A) todavía está como cuando se creó el diff
   * B) ya fue actualizada al estado READY
   *
   * Esto permite re-ejecutar el script si una ejecución
   * anterior quedó a mitad de camino.
   */
  for (
    const entry
    of diffEntries.filter(
      (item) =>
        item.result ===
        'UPDATE_RANGE',
    )
  ) {
    const id =
      entry.dbTariff?.id;

    if (!id) {
      errors.push(
        `UPDATE_RANGE sin dbTariff.id: ${tariffLabel(entry.readyTariff)}`,
      );

      continue;
    }

    const live =
      byId.get(id);

    if (!live) {
      errors.push(
        `No existe en BDD la tarifa ${id} requerida para UPDATE_RANGE.`,
      );

      continue;
    }

    if (
      sameTariffState(
        live,
        entry.dbTariff,
      )
    ) {
      continue;
    }

    if (
      sameTariffState(
        live,
        entry.readyTariff,
      )
    ) {
      alreadyApplied.updates.push(
        entry,
      );

      continue;
    }

    errors.push(
      `La tarifa ${id} cambió desde que se generó el diff.\n` +
      `Esperado BDD: ${tariffLabel(entry.dbTariff)}\n` +
      `Actual: ${tariffLabel(live)}`,
    );
  }

  /*
   * NEW:
   *
   * Si ya existe exactamente, se considera operación
   * ya aplicada.
   */
  for (
    const entry
    of diffEntries.filter(
      (item) =>
        item.result ===
        'NEW',
    )
  ) {
    const matches =
      exactLive.get(
        exactKey(
          entry.readyTariff,
        ),
      ) ?? [];

    if (
      matches.length > 0
    ) {
      alreadyApplied.news.push({
        entry,
        tariff:
          matches[0],
      });
    }
  }

  if (
    errors.length > 0
  ) {
    console.log('');
    console.log(
      '❌ La BDD cambió desde que se generó el diff:',
    );

    for (
      const error
      of errors
    ) {
      console.log('');
      console.log(
        error,
      );
    }

    throw new Error(
      'Preflight abortado. Regenerá el diff antes de sincronizar.',
    );
  }

  return {
    alreadyApplied,
  };
}

/* =========================================================
 * VALIDAR NUEVOS SOLAPAMIENTOS
 * ========================================================= */

function validateNewTariffConflicts(
  newEntries,
  dbTariffs,
) {
  const conflicts = [];

  for (
    const entry
    of newEntries
  ) {
    const ready =
      entry.readyTariff;

    const overlaps =
      dbTariffs.filter(
        (existing) =>
          existing.classId ===
            ready.classId &&
          normalizeAmount(
            existing.amount,
          ) !==
            normalizeAmount(
              ready.amount,
            ) &&
          rangesOverlap(
            existing,
            ready,
          ),
      );

    if (
      overlaps.length > 0
    ) {
      conflicts.push({
        ready,
        overlaps,
      });
    }
  }

  return conflicts;
}

/* =========================================================
 * PLAN
 * ========================================================= */

function buildPlan(
  diffEntries,
  alreadyApplied,
) {
  const appliedUpdateIds =
    new Set(
      alreadyApplied.updates.map(
        (entry) =>
          entry.dbTariff.id,
      ),
    );

  const appliedNewKeys =
    new Set(
      alreadyApplied.news.map(
        ({ entry }) =>
          exactKey(
            entry.readyTariff,
          ),
      ),
    );

  const updates =
    diffEntries.filter(
      (item) =>
        item.result ===
          'UPDATE_RANGE' &&
        !appliedUpdateIds.has(
          item.dbTariff.id,
        ),
    );

  const creates =
    diffEntries.filter(
      (item) =>
        item.result ===
          'NEW' &&
        !appliedNewKeys.has(
          exactKey(
            item.readyTariff,
          ),
        ),
    );

  return {
    updates,
    creates,
  };
}

/* =========================================================
 * OPERACIONES
 * ========================================================= */

async function updateTariffRange(
  entry,
  sessionCookie,
) {
  const id =
    entry.dbTariff.id;

  const desired =
    entry.readyTariff;

  /*
   * Solo cambiamos la vigencia.
   *
   * En nuestro diff confirmado los cinco UPDATE_RANGE
   * conservan:
   * - misma clase
   * - mismo importe
   * - mismo validFrom
   *
   * y únicamente amplían validTo.
   */
  const body = {
    validTo:
      normalizeDate(
        desired.validTo,
      ),
  };

  await apiRequest(
    'PATCH',
    `/tariffs/${id}`,
    sessionCookie,
    body,
  );
}

async function createHistoricalTariff(
  entry,
  sessionCookie,
) {
  const tariff =
    entry.readyTariff;

  const body = {
    classId:
      tariff.classId,

    name:
      tariff.name,

    amount:
      normalizeAmount(
        tariff.amount,
      ),

    validFrom:
      normalizeDate(
        tariff.validFrom,
      ),

    validTo:
      normalizeDate(
        tariff.validTo,
      ),
  };

  const response =
    await apiRequest(
      'POST',
      '/tariffs',
      sessionCookie,
      body,
    );

  const created =
    extractTariffFromResponse(
      response,
    );

  if (!created?.id) {
    throw new Error(
      `La tarifa fue creada pero no pude obtener su ID: ${tariffLabel(tariff)}`,
    );
  }

  /*
   * Todas las tarifas de esta migración histórica
   * deben permanecer INACTIVE.
   */
  if (
    DEACTIVATE_CREATED_TARIFFS
  ) {
    await apiRequest(
      'DELETE',
      `/tariffs/${created.id}`,
      sessionCookie,
    );
  }

  return created;
}

/* =========================================================
 * VERIFICACIÓN FINAL
 * ========================================================= */

function verifyFinalState(
  readyTariffs,
  dbTariffs,
) {
  const readyKeys =
    new Set(
      readyTariffs.map(
        exactKey,
      ),
    );

  const dbKeys =
    new Set(
      dbTariffs.map(
        exactKey,
      ),
    );

  const missing = [];

  for (
    const tariff
    of readyTariffs
  ) {
    if (
      !dbKeys.has(
        exactKey(
          tariff,
        ),
      )
    ) {
      missing.push(
        tariff,
      );
    }
  }

  const extra = [];

  for (
    const tariff
    of dbTariffs
  ) {
    if (
      !readyKeys.has(
        exactKey(
          tariff,
        ),
      )
    ) {
      extra.push(
        tariff,
      );
    }
  }

  return {
    missing,
    extra,
  };
}

/* =========================================================
 * MAIN
 * ========================================================= */

async function main() {
  console.log('');
  console.log(
    '=========================================================',
  );

  console.log(
    ' SINCRONIZACIÓN DE TARIFAS HISTÓRICAS',
  );

  console.log(
    '=========================================================',
  );

  console.log('');

  console.log(
    APPLY
      ? '🚨 MODO: APPLY'
      : '🧪 MODO: DRY RUN',
  );

  console.log('');

  console.log(
    `📄 Ready: ${READY_FILE}`,
  );

  console.log(
    `📄 Diff: ${DIFF_FILE}`,
  );

  /* =======================================================
   * ARCHIVOS
   * ======================================================= */

  const readyTariffs =
    await loadReady();

  const diffFile =
    await loadDiff();

  validateDiffFile(
    diffFile,
    readyTariffs,
  );

  console.log('');
  console.log(
    `📦 Tarifas ready: ${readyTariffs.length}`,
  );

  console.log(
    `✅ UNCHANGED: ${diffFile.summary.unchanged ?? 0}`,
  );

  console.log(
    `🆕 NEW: ${diffFile.summary.new ?? 0}`,
  );

  console.log(
    `🔄 UPDATE_RANGE: ${diffFile.summary.updateRange ?? 0}`,
  );

  console.log(
    `⚠️ CONFLICT: ${diffFile.summary.conflict ?? 0}`,
  );

  console.log(
    `🗑️ OBSOLETE: ${diffFile.summary.obsolete ?? 0}`,
  );

  /* =======================================================
   * LOGIN
   * ======================================================= */

  console.log('');
  console.log(
    '🔐 Iniciando sesión...',
  );

  const sessionCookie =
    await login();

  console.log(
    '✅ Sesión iniciada.',
  );

  /* =======================================================
   * BDD ACTUAL
   * ======================================================= */

  const beforeTariffs =
    await getTariffs(
      sessionCookie,
    );

  console.log(
    `💰 Tarifas actuales en BDD: ${beforeTariffs.length}`,
  );

  /* =======================================================
   * PREFLIGHT
   * ======================================================= */

  console.log('');
  console.log(
    '🔎 Ejecutando preflight...',
  );

  const {
    alreadyApplied,
  } =
    validateLiveDatabase(
      diffFile.diff,
      beforeTariffs,
    );

  const plan =
    buildPlan(
      diffFile.diff,
      alreadyApplied,
    );

  /*
   * Validamos conflictos únicamente para tarifas
   * que realmente faltan.
   */
  const newConflicts =
    validateNewTariffConflicts(
      plan.creates,
      beforeTariffs,
    );

  if (
    newConflicts.length > 0
  ) {
    console.log('');
    console.log(
      '❌ Se detectaron nuevos solapamientos contra la BDD actual:',
    );

    for (
      const conflict
      of newConflicts
    ) {
      console.log('');
      console.log(
        `Nueva: ${tariffLabel(conflict.ready)}`,
      );

      for (
        const existing
        of conflict.overlaps
      ) {
        console.log(
          `  ↳ BDD: ${tariffLabel(existing)}`,
        );
      }
    }

    throw new Error(
      'Preflight abortado por solapamientos.',
    );
  }

  console.log(
    '✅ Preflight correcto.',
  );

  if (
    alreadyApplied.updates.length > 0 ||
    alreadyApplied.news.length > 0
  ) {
    console.log('');
    console.log(
      'ℹ️ Se detectaron operaciones ya aplicadas:',
    );

    console.log(
      `   UPDATE_RANGE ya aplicados: ${alreadyApplied.updates.length}`,
    );

    console.log(
      `   NEW ya existentes: ${alreadyApplied.news.length}`,
    );
  }

  /* =======================================================
   * PLAN
   * ======================================================= */

  console.log('');
  console.log(
    '=========================================================',
  );

  console.log(
    ' PLAN DE SINCRONIZACIÓN',
  );

  console.log(
    '=========================================================',
  );

  console.log('');
  console.log(
    `🔄 UPDATE pendientes: ${plan.updates.length}`,
  );

  console.log(
    `🆕 CREATE pendientes: ${plan.creates.length}`,
  );

  console.log(
    '🗑️ DELETE: 0',
  );

  if (
    plan.updates.length > 0
  ) {
    console.log('');
    console.log(
      '--- UPDATE_RANGE ---',
    );

    for (
      const entry
      of plan.updates
    ) {
      console.log('');
      console.log(
        `${entry.dbTariff.id}`,
      );

      console.log(
        `  ${entry.className}`,
      );

      console.log(
        `  $${entry.amount}`,
      );

      console.log(
        `  ${entry.dbTariff.validFrom} → ${entry.dbTariff.validTo}`,
      );

      console.log(
        `  ↓`,
      );

      console.log(
        `  ${entry.readyTariff.validFrom} → ${entry.readyTariff.validTo}`,
      );
    }
  }

  if (
    plan.creates.length > 0
  ) {
    console.log('');
    console.log(
      '--- CREATE ---',
    );

    for (
      const entry
      of plan.creates
    ) {
      console.log(
        `+ ${tariffLabel(entry.readyTariff)}`,
      );
    }
  }

  /* =======================================================
   * DRY RUN
   * ======================================================= */

  if (!APPLY) {
    console.log('');
    console.log(
      '=========================================================',
    );

    console.log(
      ' 🧪 DRY RUN FINALIZADO',
    );

    console.log(
      '=========================================================',
    );

    console.log('');
    console.log(
      '✅ No se modificó la BDD.',
    );

    console.log('');
    console.log(
      'Para aplicar estos cambios:',
    );

    console.log('');
    console.log(
      'node scripts/sync-historical-tariffs.mjs --apply',
    );

    console.log('');

    return;
  }

  /* =======================================================
   * APPLY
   * ======================================================= */

  console.log('');
  console.log(
    '=========================================================',
  );

  console.log(
    ' 🚨 APLICANDO CAMBIOS',
  );

  console.log(
    '=========================================================',
  );

  let updated = 0;
  let created = 0;
  let deactivated = 0;

  /*
   * Primero actualizamos los rangos existentes.
   */
  for (
    const entry
    of plan.updates
  ) {
    console.log('');
    console.log(
      `🔄 Actualizando ${entry.className}`,
    );

    console.log(
      `   ${entry.dbTariff.validTo} → ${entry.readyTariff.validTo}`,
    );

    await updateTariffRange(
      entry,
      sessionCookie,
    );

    updated++;

    console.log(
      '   ✅ Actualizada',
    );
  }

  /*
   * Después creamos los nuevos períodos.
   */
  for (
    const entry
    of plan.creates
  ) {
    console.log('');
    console.log(
      `🆕 Creando ${tariffLabel(entry.readyTariff)}`,
    );

    const createdTariff =
      await createHistoricalTariff(
        entry,
        sessionCookie,
      );

    created++;

    console.log(
      `   ✅ Creada: ${createdTariff.id}`,
    );

    if (
      DEACTIVATE_CREATED_TARIFFS
    ) {
      deactivated++;

      console.log(
        '   💤 Desactivada como tarifa histórica',
      );
    }
  }

  /* =======================================================
   * VERIFICACIÓN FINAL
   * ======================================================= */

  console.log('');
  console.log(
    '🔎 Verificando estado final...',
  );

  const afterTariffs =
    await getTariffs(
      sessionCookie,
    );

  const verification =
    verifyFinalState(
      readyTariffs,
      afterTariffs,
    );

  console.log('');
  console.log(
    '=========================================================',
  );

  console.log(
    ' RESULTADO FINAL',
  );

  console.log(
    '=========================================================',
  );

  console.log('');
  console.log(
    `🔄 Tarifas actualizadas: ${updated}`,
  );

  console.log(
    `🆕 Tarifas creadas: ${created}`,
  );

  console.log(
    `💤 Tarifas nuevas desactivadas: ${deactivated}`,
  );

  console.log(
    `💰 Tarifas totales en BDD: ${afterTariffs.length}`,
  );

  console.log(
    `❌ Ready faltantes en BDD: ${verification.missing.length}`,
  );

  console.log(
    `⚠️ Extras en BDD: ${verification.extra.length}`,
  );

  if (
    verification.missing.length > 0
  ) {
    console.log('');
    console.log(
      '--- READY FALTANTES ---',
    );

    for (
      const tariff
      of verification.missing
    ) {
      console.log(
        tariffLabel(
          tariff,
        ),
      );
    }
  }

  if (
    verification.extra.length > 0
  ) {
    console.log('');
    console.log(
      '--- EXTRAS BDD ---',
    );

    for (
      const tariff
      of verification.extra
    ) {
      console.log(
        tariffLabel(
          tariff,
        ),
      );
    }
  }

  if (
    verification.missing.length > 0 ||
    verification.extra.length > 0
  ) {
    throw new Error(
      'La sincronización terminó, pero la BDD no coincide exactamente con el dataset ready.',
    );
  }

  console.log('');
  console.log(
    '✅ BDD sincronizada exactamente con historical-tariffs-ready.json.',
  );

  console.log('');
  console.log(
    'Siguiente verificación recomendada:',
  );

  console.log('');
  console.log(
    'node scripts/compare-historical-tariffs-with-db.mjs',
  );

  console.log('');
}

/* =========================================================
 * RUN
 * ========================================================= */

main().catch(
  (error) => {
    console.error('');
    console.error(
      '❌ ERROR',
    );

    console.error(
      error instanceof Error
        ? error.stack ??
          error.message
        : error,
    );

    console.error('');

    process.exitCode =
      1;
  },
);