import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import xlsx from 'xlsx';

loadEnvFile('.env');

const { utils, writeFile } = xlsx;

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

const OUTPUT_DIR = path.resolve(
  './exports',
);

const OUTPUT_JSON = path.join(
  OUTPUT_DIR,
  'historical-tariffs-db-diff.json',
);

const OUTPUT_XLSX = path.join(
  OUTPUT_DIR,
  'historical-tariffs-db-diff.xlsx',
);

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

function classAmountKey(tariff) {
  return [
    tariff.classId,
    normalizeAmount(tariff.amount),
  ].join('|');
}

function classKey(tariff) {
  return tariff.classId;
}

function tariffLabel(tariff) {
  return (
    `${tariff.className ?? tariff.classId} | ` +
    `$${normalizeAmount(tariff.amount)} | ` +
    `${normalizeDate(tariff.validFrom)} → ` +
    `${normalizeDate(tariff.validTo) ?? 'null'}`
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

  return (
    aStart <= bEnd &&
    bStart <= aEnd
  );
}

function compareRanges(a, b) {
  return {
    sameStart:
      normalizeDate(a.validFrom) ===
      normalizeDate(b.validFrom),

    sameEnd:
      normalizeDate(a.validTo) ===
      normalizeDate(b.validTo),

    readyFrom:
      normalizeDate(a.validFrom),

    readyTo:
      normalizeDate(a.validTo),

    dbFrom:
      normalizeDate(b.validFrom),

    dbTo:
      normalizeDate(b.validTo),
  };
}

/* =========================================================
 * FILE
 * ========================================================= */

async function readReadyTariffs() {
  const raw =
    await fs.readFile(
      READY_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(raw);

  const tariffs =
    Array.isArray(parsed)
      ? parsed
      : parsed.tariffs;

  if (!Array.isArray(tariffs)) {
    throw new Error(
      'historical-tariffs-ready.json no contiene un array de tarifas.',
    );
  }

  return tariffs.map(
    (tariff) => ({
      ...tariff,

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
    }),
  );
}

/* =========================================================
 * API
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

async function apiJson(
  url,
  sessionCookie,
) {
  const response =
    await fetch(
      `${API_BASE_URL}${url}`,
      {
        headers: {
          Cookie:
            sessionCookie,
        },
      },
    );

  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `GET ${url} → ${response.status}: ${body}`,
    );
  }

  return response.json();
}

async function readDbTariffs(
  sessionCookie,
) {
  const response =
    await apiJson(
      '/tariffs',
      sessionCookie,
    );

  if (!Array.isArray(response)) {
    throw new Error(
      'GET /tariffs no devolvió un array.',
    );
  }

  return response.map(
    (tariff) => ({
      ...tariff,

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
    }),
  );
}

/* =========================================================
 * INDEXES
 * ========================================================= */

function indexByExact(tariffs) {
  const map =
    new Map();

  for (const tariff of tariffs) {
    map.set(
      exactKey(tariff),
      tariff,
    );
  }

  return map;
}

function indexByClassAmount(tariffs) {
  const map =
    new Map();

  for (const tariff of tariffs) {
    const key =
      classAmountKey(tariff);

    if (!map.has(key)) {
      map.set(
        key,
        [],
      );
    }

    map
      .get(key)
      .push(tariff);
  }

  return map;
}

function indexByClass(tariffs) {
  const map =
    new Map();

  for (const tariff of tariffs) {
    const key =
      classKey(tariff);

    if (!map.has(key)) {
      map.set(
        key,
        [],
      );
    }

    map
      .get(key)
      .push(tariff);
  }

  return map;
}

/* =========================================================
 * MATCHING
 * ========================================================= */

function findBestRangeCandidate(
  readyTariff,
  dbCandidates,
  matchedDbIds,
) {
  if (
    !dbCandidates ||
    dbCandidates.length === 0
  ) {
    return null;
  }

  /*
   * Una tarifa de BDD solo puede participar
   * en un match.
   */
  const available =
    dbCandidates.filter(
      (item) =>
        !matchedDbIds.has(
          item.id,
        ),
    );

  if (
    available.length === 0
  ) {
    return null;
  }

  /*
   * UPDATE_RANGE solo tiene sentido si existe
   * una relación temporal clara.
   *
   * No alcanza con tener:
   * - misma clase
   * - mismo importe
   *
   * porque $15.000 de febrero 2025 y
   * $15.000 de julio 2026 son tarifas distintas.
   */

  const sameStart =
    available.find(
      (item) =>
        normalizeDate(
          item.validFrom,
        ) ===
        normalizeDate(
          readyTariff.validFrom,
        ),
    );

  if (sameStart) {
    return sameStart;
  }

  const sameEnd =
    available.find(
      (item) =>
        normalizeDate(
          item.validTo,
        ) ===
        normalizeDate(
          readyTariff.validTo,
        ),
    );

  if (sameEnd) {
    return sameEnd;
  }

  const overlap =
    available.find(
      (item) =>
        rangesOverlap(
          readyTariff,
          item,
        ),
    );

  if (overlap) {
    return overlap;
  }

  /*
   * IMPORTANTE:
   * Si no hay relación temporal,
   * NO asumimos que es la misma tarifa.
   */
  return null;
}

/* =========================================================
 * DIFF
 * ========================================================= */

function buildDiff(
  readyTariffs,
  dbTariffs,
) {
  const dbExact =
    indexByExact(
      dbTariffs,
    );

  const dbByClassAmount =
    indexByClassAmount(
      dbTariffs,
    );

  const dbByClass =
    indexByClass(
      dbTariffs,
    );

  const matchedDbIds =
    new Set();

  const entries = [];

  for (
    const readyTariff
    of readyTariffs
  ) {
    const exactCandidate =
        dbExact.get(
            exactKey(
            readyTariff,
            ),
        );

    const exact =
    exactCandidate &&
    !matchedDbIds.has(
        exactCandidate.id,
    )
        ? exactCandidate
        : null;

    if (exact) {
      matchedDbIds.add(
        exact.id,
      );

      entries.push({
        result:
          'UNCHANGED',

        classId:
          readyTariff.classId,

        className:
          readyTariff.className,

        amount:
          readyTariff.amount,

        readyTariff,

        dbTariff:
          exact,

        reason:
          'La tarifa existe exactamente igual en la BDD.',
      });

      continue;
    }

    const sameClassAmount =
      dbByClassAmount.get(
        classAmountKey(
          readyTariff,
        ),
      ) ?? [];

    const rangeCandidate =
    findBestRangeCandidate(
        readyTariff,
        sameClassAmount,
        matchedDbIds,
    );

    if (rangeCandidate) {
      matchedDbIds.add(
        rangeCandidate.id,
      );

      entries.push({
        result:
          'UPDATE_RANGE',

        classId:
          readyTariff.classId,

        className:
          readyTariff.className,

        amount:
          readyTariff.amount,

        readyTariff,

        dbTariff:
          rangeCandidate,

        rangeComparison:
          compareRanges(
            readyTariff,
            rangeCandidate,
          ),

        reason:
          'Existe una tarifa de la misma clase e importe, pero con un rango de vigencia distinto.',
      });

      continue;
    }

    const sameClass =
      dbByClass.get(
        classKey(
          readyTariff,
        ),
      ) ?? [];

    const conflicting =
      sameClass.filter(
        (item) =>
          rangesOverlap(
            readyTariff,
            item,
          ),
      );

    if (
      conflicting.length > 0
    ) {
      for (
        const item
        of conflicting
      ) {
        matchedDbIds.add(
          item.id,
        );
      }

      entries.push({
        result:
          'CONFLICT',

        classId:
          readyTariff.classId,

        className:
          readyTariff.className,

        amount:
          readyTariff.amount,

        readyTariff,

        dbTariffs:
          conflicting,

        reason:
          'La nueva tarifa se solapa con una o más tarifas de la misma clase pero con importe diferente.',
      });

      continue;
    }

    entries.push({
      result:
        'NEW',

      classId:
        readyTariff.classId,

      className:
        readyTariff.className,

      amount:
        readyTariff.amount,

      readyTariff,

      dbTariff:
        null,

      reason:
        'No existe una tarifa equivalente en la BDD.',
    });
  }

  /*
   * Tarifas de la BDD que no fueron usadas
   * por ningún match del nuevo dataset.
   */
  const obsolete =
    dbTariffs.filter(
      (tariff) =>
        !matchedDbIds.has(
          tariff.id,
        ),
    );

  for (
    const tariff
    of obsolete
  ) {
    entries.push({
      result:
        'OBSOLETE',

      classId:
        tariff.classId,

      className:
        tariff.className,

      amount:
        tariff.amount,

      readyTariff:
        null,

      dbTariff:
        tariff,

      reason:
        'La tarifa existe en la BDD pero ya no aparece en el dataset histórico reconstruido.',
    });
  }

  return entries;
}

/* =========================================================
 * VALIDACIONES ADICIONALES
 * ========================================================= */

function findReadyOverlaps(
  tariffs,
) {
  const byClass =
    indexByClass(
      tariffs,
    );

  const overlaps = [];

  for (
    const [classId, items]
    of byClass
  ) {
    const sorted =
      [...items]
        .sort(
          (a, b) =>
            a.validFrom.localeCompare(
              b.validFrom,
            ),
        );

    for (
      let index = 0;
      index < sorted.length - 1;
      index++
    ) {
      const current =
        sorted[index];

      const next =
        sorted[index + 1];

      if (
        rangesOverlap(
          current,
          next,
        )
      ) {
        overlaps.push({
          classId,

          className:
            current.className,

          first:
            current,

          second:
            next,
        });
      }
    }
  }

  return overlaps;
}

/* =========================================================
 * OUTPUT HELPERS
 * ========================================================= */

function countByResult(entries) {
  const counts = {};

  for (const item of entries) {
    counts[item.result] =
      (counts[item.result] ?? 0) +
      1;
  }

  return counts;
}

function flattenDiffRow(entry) {
  return {
    Resultado:
      entry.result,

    Clase:
      entry.className ?? '',

    'Class ID':
      entry.classId ?? '',

    Importe:
      entry.amount ?? '',

    'Ready desde':
      entry.readyTariff?.validFrom ??
      '',

    'Ready hasta':
      entry.readyTariff?.validTo ??
      '',

    'Ready nombre':
      entry.readyTariff?.name ??
      '',

    'BDD ID':
      entry.dbTariff?.id ??
      '',

    'BDD desde':
      entry.dbTariff?.validFrom ??
      '',

    'BDD hasta':
      entry.dbTariff?.validTo ??
      '',

    'BDD importe':
      entry.dbTariff?.amount ??
      '',

    'BDD estado':
      entry.dbTariff?.status ??
      '',

    Motivo:
      entry.reason,
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
    ' COMPARACIÓN TARIFAS HISTÓRICAS vs BDD',
  );

  console.log(
    '=========================================================',
  );

  console.log('');

  console.log(
    `📄 Dataset ready: ${READY_FILE}`,
  );

  const readyTariffs =
    await readReadyTariffs();

  console.log(
    `📦 Tarifas históricas ready: ${readyTariffs.length}`,
  );

  console.log('');
  console.log(
    '🔐 Iniciando sesión...',
  );

  const sessionCookie =
    await login();

  console.log(
    '✅ Sesión iniciada.',
  );

  const dbTariffs =
    await readDbTariffs(
      sessionCookie,
    );

  console.log(
    `💰 Tarifas en BDD: ${dbTariffs.length}`,
  );

  /* -------------------------------------------------------
   * Validar dataset ready
   * ------------------------------------------------------- */

  const readyOverlaps =
    findReadyOverlaps(
      readyTariffs,
    );

  console.log('');
  console.log(
    `💥 Solapamientos internos en ready: ${readyOverlaps.length}`,
  );

  if (
    readyOverlaps.length > 0
  ) {
    console.log('');
    console.log(
      '⚠️ El dataset ready contiene solapamientos. Revisar antes de sincronizar.',
    );
  }

  /* -------------------------------------------------------
   * Diff
   * ------------------------------------------------------- */

  const diff =
    buildDiff(
      readyTariffs,
      dbTariffs,
    );

  const counts =
    countByResult(
      diff,
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
    `✅ UNCHANGED: ${counts.UNCHANGED ?? 0}`,
  );

  console.log(
    `🆕 NEW: ${counts.NEW ?? 0}`,
  );

  console.log(
    `🔄 UPDATE_RANGE: ${counts.UPDATE_RANGE ?? 0}`,
  );

  console.log(
    `⚠️ CONFLICT: ${counts.CONFLICT ?? 0}`,
  );

  console.log(
    `🗑️ OBSOLETE: ${counts.OBSOLETE ?? 0}`,
  );

  /* -------------------------------------------------------
   * Detalle update range
   * ------------------------------------------------------- */

  const updates =
    diff.filter(
      (item) =>
        item.result ===
        'UPDATE_RANGE',
    );

  if (
    updates.length > 0
  ) {
    console.log('');
    console.log(
      '--- UPDATE_RANGE ---',
    );

    for (
      const item
      of updates
    ) {
      console.log('');
      console.log(
        tariffLabel(
          item.readyTariff,
        ),
      );

      console.log(
        `  BDD: ${item.dbTariff.validFrom} → ${item.dbTariff.validTo}`,
      );

      console.log(
        `  READY: ${item.readyTariff.validFrom} → ${item.readyTariff.validTo}`,
      );
    }
  }

  /* -------------------------------------------------------
   * Detalle new
   * ------------------------------------------------------- */

  const newTariffs =
    diff.filter(
      (item) =>
        item.result ===
        'NEW',
    );

  if (
    newTariffs.length > 0
  ) {
    console.log('');
    console.log(
      '--- NEW ---',
    );

    for (
      const item
      of newTariffs
    ) {
      console.log(
        tariffLabel(
          item.readyTariff,
        ),
      );
    }
  }

  /* -------------------------------------------------------
   * Detalle obsolete
   * ------------------------------------------------------- */

  const obsolete =
    diff.filter(
      (item) =>
        item.result ===
        'OBSOLETE',
    );

  if (
    obsolete.length > 0
  ) {
    console.log('');
    console.log(
      '--- OBSOLETE ---',
    );

    for (
      const item
      of obsolete
    ) {
      console.log(
        `${item.dbTariff.id} | ${tariffLabel(item.dbTariff)}`,
      );
    }
  }

  /* -------------------------------------------------------
   * JSON
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

    source:
      READY_FILE,

    summary: {
      readyTariffCount:
        readyTariffs.length,

      dbTariffCount:
        dbTariffs.length,

      unchanged:
        counts.UNCHANGED ?? 0,

      new:
        counts.NEW ?? 0,

      updateRange:
        counts.UPDATE_RANGE ?? 0,

      conflict:
        counts.CONFLICT ?? 0,

      obsolete:
        counts.OBSOLETE ?? 0,

      readyInternalOverlaps:
        readyOverlaps.length,
    },

    diff,

    readyOverlaps,
  };

  await fs.writeFile(
    OUTPUT_JSON,
    JSON.stringify(
      output,
      null,
      2,
    ),
    'utf8',
  );

  /* -------------------------------------------------------
   * XLSX
   * ------------------------------------------------------- */

  const workbook =
    utils.book_new();

  const summaryRows = [
    {
      Métrica:
        'Tarifas ready',

      Cantidad:
        readyTariffs.length,
    },
    {
      Métrica:
        'Tarifas BDD',

      Cantidad:
        dbTariffs.length,
    },
    {
      Métrica:
        'UNCHANGED',

      Cantidad:
        counts.UNCHANGED ?? 0,
    },
    {
      Métrica:
        'NEW',

      Cantidad:
        counts.NEW ?? 0,
    },
    {
      Métrica:
        'UPDATE_RANGE',

      Cantidad:
        counts.UPDATE_RANGE ?? 0,
    },
    {
      Métrica:
        'CONFLICT',

      Cantidad:
        counts.CONFLICT ?? 0,
    },
    {
      Métrica:
        'OBSOLETE',

      Cantidad:
        counts.OBSOLETE ?? 0,
    },
    {
      Métrica:
        'Solapamientos internos ready',

      Cantidad:
        readyOverlaps.length,
    },
  ];

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      summaryRows,
    ),
    'Resumen',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      diff.map(
        flattenDiffRow,
      ),
    ),
    'Diff completo',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      diff
        .filter(
          (item) =>
            item.result ===
            'UNCHANGED',
        )
        .map(
          flattenDiffRow,
        ),
    ),
    'UNCHANGED',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      diff
        .filter(
          (item) =>
            item.result ===
            'NEW',
        )
        .map(
          flattenDiffRow,
        ),
    ),
    'NEW',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      diff
        .filter(
          (item) =>
            item.result ===
            'UPDATE_RANGE',
        )
        .map(
          flattenDiffRow,
        ),
    ),
    'UPDATE_RANGE',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      diff
        .filter(
          (item) =>
            item.result ===
            'CONFLICT',
        )
        .map(
          flattenDiffRow,
        ),
    ),
    'CONFLICT',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      diff
        .filter(
          (item) =>
            item.result ===
            'OBSOLETE',
        )
        .map(
          flattenDiffRow,
        ),
    ),
    'OBSOLETE',
  );

  const overlapRows =
    readyOverlaps.map(
      (item) => ({
        Clase:
          item.className,

        'Class ID':
          item.classId,

        'Importe 1':
          item.first.amount,

        'Desde 1':
          item.first.validFrom,

        'Hasta 1':
          item.first.validTo,

        'Importe 2':
          item.second.amount,

        'Desde 2':
          item.second.validFrom,

        'Hasta 2':
          item.second.validTo,
      }),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      overlapRows,
    ),
    'Solapamientos ready',
  );

  writeFile(
    workbook,
    OUTPUT_XLSX,
  );

  console.log('');
  console.log(
    `📝 JSON: ${OUTPUT_JSON}`,
  );

  console.log(
    `📊 Excel: ${OUTPUT_XLSX}`,
  );

  console.log('');

  if (
    (counts.CONFLICT ?? 0) > 0 ||
    readyOverlaps.length > 0
  ) {
    console.log(
      '⚠️ Hay conflictos. No recomiendo sincronizar todavía.',
    );
  } else {
    console.log(
      '✅ Comparación finalizada. No se modificó la BDD.',
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
        ? error.stack ?? error.message
        : error,
    );

    process.exitCode =
      1;
  },
);