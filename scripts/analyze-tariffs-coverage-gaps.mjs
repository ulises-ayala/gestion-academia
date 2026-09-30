import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import xlsx from 'xlsx';

loadEnvFile('.env');

const { utils, writeFile } = xlsx;

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

const ENROLLMENTS_FILE = path.resolve(
  './exports/enrollments-current.json',
);

const HISTORICAL_TARIFFS_FILE = path.resolve(
  './exports/historical-tariffs-ready.json',
);

const OUTPUT_DIR = path.resolve(
  './exports',
);

const OUTPUT_JSON = path.join(
  OUTPUT_DIR,
  'tariff-coverage-gaps-analysis.json',
);

const OUTPUT_XLSX = path.join(
  OUTPUT_DIR,
  'tariff-coverage-gaps-analysis.xlsx',
);

const HISTORICAL_CUTOFF =
  '2026-08-31';

/*
 * Clases que queremos estudiar especialmente.
 * Podés agregar o quitar nombres.
 */
const TARGET_CLASS_NAMES = new Set([
  'S.C Infantil (6-11 años)',
  'S.C Adultos (+18 años)',
  'S.C Juvenil (12-17 años)',
  'Ladys Kizz',
  'Street Int/Avanzado',
]);

/* =========================================================
 * HELPERS GENERALES
 * ========================================================= */

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      `${String(value).slice(0, 10)}T00:00:00.000Z`,
    );

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function isoDate(date) {
  return date
    .toISOString()
    .slice(0, 10);
}

function firstDayOfMonth(value) {
  const date =
    parseIsoDate(value);

  if (!date) {
    return null;
  }

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1,
    ),
  );
}

function lastDayOfMonth(value) {
  const date =
    parseIsoDate(value);

  if (!date) {
    return null;
  }

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      0,
    ),
  );
}

function nextMonth(date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      1,
    ),
  );
}

function monthKey(value) {
  return String(value)
    .slice(0, 7);
}

function normalizeAmount(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number.toFixed(2)
    : null;
}

function studentName(enrollment) {
  const first =
    enrollment.student?.firstName ?? '';

  const last =
    enrollment.student?.lastName ?? '';

  return `${last} ${first}`
    .trim();
}

function className(enrollment) {
  return (
    enrollment.academicClass?.name ??
    enrollment.className ??
    ''
  );
}

/* =========================================================
 * LECTURA DE ARCHIVOS
 * ========================================================= */

async function readJson(file) {
  const raw =
    await fs.readFile(
      file,
      'utf8',
    );

  return JSON.parse(raw);
}

async function readEnrollments() {
  const parsed =
    await readJson(
      ENROLLMENTS_FILE,
    );

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed.items)) {
    return parsed.items;
  }

  if (Array.isArray(parsed.enrollments)) {
    return parsed.enrollments;
  }

  throw new Error(
    'No pude encontrar el array de enrollments en enrollments-current.json',
  );
}

async function readHistoricalReadyTariffs() {
  try {
    const parsed =
      await readJson(
        HISTORICAL_TARIFFS_FILE,
      );

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (Array.isArray(parsed.tariffs)) {
      return parsed.tariffs;
    }

    if (Array.isArray(parsed.items)) {
      return parsed.items;
    }

    return [];
  } catch (error) {
    console.warn(
      '⚠️ No se pudo leer historical-tariffs-ready.json',
    );

    console.warn(
      error instanceof Error
        ? error.message
        : String(error),
    );

    return [];
  }
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

/* =========================================================
 * ÍNDICES
 * ========================================================= */

function indexTariffsByClass(tariffs) {
  const map =
    new Map();

  for (const tariff of tariffs) {
    if (!tariff.classId) {
      continue;
    }

    if (!map.has(tariff.classId)) {
      map.set(
        tariff.classId,
        [],
      );
    }

    map
      .get(tariff.classId)
      .push({
        ...tariff,

        amount:
          normalizeAmount(
            tariff.amount,
          ),

        validFromDate:
          parseIsoDate(
            tariff.validFrom,
          ),

        validToDate:
          tariff.validTo
            ? parseIsoDate(
                tariff.validTo,
              )
            : null,
      });
  }

  for (const items of map.values()) {
    items.sort(
      (a, b) =>
        a.validFrom.localeCompare(
          b.validFrom,
        ),
    );
  }

  return map;
}

function indexEnrollmentsByClass(enrollments) {
  const map =
    new Map();

  for (const enrollment of enrollments) {
    if (!enrollment.classId) {
      continue;
    }

    if (!map.has(enrollment.classId)) {
      map.set(
        enrollment.classId,
        [],
      );
    }

    map
      .get(enrollment.classId)
      .push(enrollment);
  }

  return map;
}

/* =========================================================
 * COBERTURA DE TARIFAS
 * ========================================================= */

function tariffMonths(tariffs) {
  const months =
    new Set();

  for (const tariff of tariffs) {
    const start =
      firstDayOfMonth(
        tariff.validFrom,
      );

    if (!start) {
      continue;
    }

    const end =
      tariff.validTo
        ? lastDayOfMonth(
            tariff.validTo,
          )
        : lastDayOfMonth(
            HISTORICAL_CUTOFF,
          );

    if (!end) {
      continue;
    }

    let cursor =
      new Date(start);

    while (
      cursor <= end
    ) {
      months.add(
        isoDate(cursor)
          .slice(0, 7),
      );

      cursor =
        nextMonth(cursor);
    }
  }

  return months;
}

function enrollmentMonths(enrollment) {
  const start =
    firstDayOfMonth(
      enrollment.startDate,
    );

  if (!start) {
    return [];
  }

  /*
   * Para análisis histórico:
   * - si hay endDate, respetarlo
   * - si no hay endDate, mirar hasta el cutoff
   *
   * Esto NO implica asumir que la inscripción realmente
   * duró hasta el cutoff.
   */
  const end =
    lastDayOfMonth(
      enrollment.endDate ??
      HISTORICAL_CUTOFF,
    );

  if (!end) {
    return [];
  }

  const months = [];

  let cursor =
    new Date(start);

  while (
    cursor <= end &&
    isoDate(cursor) <=
      HISTORICAL_CUTOFF
  ) {
    months.push(
      isoDate(cursor)
        .slice(0, 7),
    );

    cursor =
      nextMonth(cursor);
  }

  return months;
}

/* =========================================================
 * ANÁLISIS POR CLASE
 * ========================================================= */

function analyzeClassCoverage({
  classId,
  className,
  enrollments,
  tariffs,
}) {
  const coveredMonths =
    tariffMonths(
      tariffs,
    );

  const enrollmentMonthMap =
    new Map();

  for (const enrollment of enrollments) {
    for (
      const month
      of enrollmentMonths(
        enrollment,
      )
    ) {
      if (!enrollmentMonthMap.has(month)) {
        enrollmentMonthMap.set(
          month,
          [],
        );
      }

      enrollmentMonthMap
        .get(month)
        .push(enrollment);
    }
  }

  const monthsWithEnrollments =
    [...enrollmentMonthMap.keys()]
      .sort();

  const uncoveredMonths =
    monthsWithEnrollments.filter(
      (month) =>
        !coveredMonths.has(
          month,
        ),
    );

  const coveredEnrollmentMonths =
    monthsWithEnrollments.filter(
      (month) =>
        coveredMonths.has(
          month,
        ),
    );

  const firstEnrollmentMonth =
    monthsWithEnrollments[0] ??
    null;

  const lastEnrollmentMonth =
    monthsWithEnrollments[
      monthsWithEnrollments.length - 1
    ] ?? null;

  const firstTariffMonth =
    tariffs.length > 0
      ? monthKey(
          tariffs[0].validFrom,
        )
      : null;

  const lastTariffMonth =
    tariffs.length > 0
      ? [...tariffs]
          .map(
            (item) =>
              monthKey(
                item.validTo ??
                HISTORICAL_CUTOFF,
              ),
          )
          .sort()
          .at(-1) ?? null
      : null;

  const uncoveredDetails =
    uncoveredMonths.map(
      (month) => {
        const monthEnrollments =
          enrollmentMonthMap.get(
            month,
          ) ?? [];

        return {
          month,

          enrollmentCount:
            monthEnrollments.length,

          studentCount:
            new Set(
              monthEnrollments.map(
                (item) =>
                  item.studentId,
              ),
            ).size,

          enrollments:
            monthEnrollments.map(
              (item) => ({
                enrollmentId:
                  item.id,

                studentId:
                  item.studentId,

                studentName:
                  studentName(
                    item,
                  ),

                startDate:
                  item.startDate,

                endDate:
                  item.endDate ??
                  null,

                status:
                  item.status,
              }),
            ),
        };
      },
    );

  return {
    classId,
    className,

    enrollmentCount:
      enrollments.length,

    studentCount:
      new Set(
        enrollments.map(
          (item) =>
            item.studentId,
        ),
      ).size,

    tariffCount:
      tariffs.length,

    firstEnrollmentMonth,
    lastEnrollmentMonth,

    firstTariffMonth,
    lastTariffMonth,

    coveredMonthCount:
      coveredEnrollmentMonths.length,

    uncoveredMonthCount:
      uncoveredMonths.length,

    coveredMonths:
      [...coveredMonths]
        .sort(),

    enrollmentMonths:
      monthsWithEnrollments,

    uncoveredMonths,

    uncoveredDetails,

    tariffs:
      tariffs.map(
        (tariff) => ({
          id:
            tariff.id,

          name:
            tariff.name,

          amount:
            tariff.amount,

          validFrom:
            tariff.validFrom,

          validTo:
            tariff.validTo,

          status:
            tariff.status,
        }),
      ),
  };
}

/* =========================================================
 * COMPARACIÓN API vs READY JSON
 * ========================================================= */

function buildReadyTariffIndex(
  readyTariffs,
) {
  const map =
    new Map();

  for (const tariff of readyTariffs) {
    const key =
      [
        tariff.classId,
        normalizeAmount(
          tariff.amount,
        ),
        tariff.validFrom,
        tariff.validTo ??
          '',
      ].join('|');

    map.set(
      key,
      tariff,
    );
  }

  return map;
}

function buildApiTariffIndex(
  tariffs,
) {
  const map =
    new Map();

  for (const tariff of tariffs) {
    const key =
      [
        tariff.classId,
        normalizeAmount(
          tariff.amount,
        ),
        tariff.validFrom,
        tariff.validTo ??
          '',
      ].join('|');

    map.set(
      key,
      tariff,
    );
  }

  return map;
}

function compareTariffSources({
  apiTariffs,
  readyTariffs,
}) {
  const apiIndex =
    buildApiTariffIndex(
      apiTariffs,
    );

  const readyIndex =
    buildReadyTariffIndex(
      readyTariffs,
    );

  const missingInApi = [];

  for (
    const [key, tariff]
    of readyIndex
  ) {
    if (!apiIndex.has(key)) {
      missingInApi.push({
        key,
        ...tariff,
      });
    }
  }

  const extraInApi = [];

  for (
    const [key, tariff]
    of apiIndex
  ) {
    if (!readyIndex.has(key)) {
      extraInApi.push({
        key,
        ...tariff,
      });
    }
  }

  return {
    missingInApi,
    extraInApi,
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
    ' ANÁLISIS DE COBERTURA DE TARIFAS',
  );

  console.log(
    '=========================================================',
  );

  console.log('');

  console.log(
    `📄 Enrollments: ${ENROLLMENTS_FILE}`,
  );

  console.log(
    `📄 Tarifas ready: ${HISTORICAL_TARIFFS_FILE}`,
  );

  console.log(
    `📅 Corte histórico: ${HISTORICAL_CUTOFF}`,
  );

  /* -------------------------------------------------------
   * 1. Archivos
   * ------------------------------------------------------- */

  const enrollments =
    await readEnrollments();

  const readyTariffs =
    await readHistoricalReadyTariffs();

  console.log(
    `🎓 Enrollments: ${enrollments.length}`,
  );

  console.log(
    `📦 Tarifas ready: ${readyTariffs.length}`,
  );

  /* -------------------------------------------------------
   * 2. API
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

  const apiTariffs =
    await apiJson(
      '/tariffs',
      sessionCookie,
    );

  if (!Array.isArray(apiTariffs)) {
    throw new Error(
      'GET /tariffs no devolvió un array.',
    );
  }

  console.log(
    `💰 Tarifas en BDD: ${apiTariffs.length}`,
  );

  const classesResponse =
    await apiJson(
      '/classes?page=1&pageSize=100',
      sessionCookie,
    );

  const classes =
    Array.isArray(classesResponse)
      ? classesResponse
      : classesResponse.items ?? [];

  console.log(
    `💃 Clases en API: ${classes.length}`,
  );

  /* -------------------------------------------------------
   * 3. Comparar ready vs BDD
   * ------------------------------------------------------- */

  const sourceComparison =
    compareTariffSources({
      apiTariffs,
      readyTariffs,
    });

  console.log('');
  console.log(
    '--- COMPARACIÓN READY vs BDD ---',
  );

  console.log(
    `Faltantes en BDD: ${sourceComparison.missingInApi.length}`,
  );

  console.log(
    `Extras en BDD: ${sourceComparison.extraInApi.length}`,
  );

  /* -------------------------------------------------------
   * 4. Índices
   * ------------------------------------------------------- */

  const tariffsByClass =
    indexTariffsByClass(
      apiTariffs,
    );

  const enrollmentsByClass =
    indexEnrollmentsByClass(
      enrollments,
    );

  /* -------------------------------------------------------
   * 5. Resolver clases objetivo
   * ------------------------------------------------------- */

  const targetClasses =
    classes.filter(
      (item) =>
        TARGET_CLASS_NAMES.has(
          item.name,
        ),
    );

  console.log('');
  console.log(
    `🎯 Clases objetivo encontradas: ${targetClasses.length}`,
  );

  for (const item of targetClasses) {
    console.log(
      `- ${item.name}`,
    );
  }

  /* -------------------------------------------------------
   * 6. Analizar cobertura
   * ------------------------------------------------------- */

  const analyses =
    targetClasses.map(
      (academicClass) =>
        analyzeClassCoverage({
          classId:
            academicClass.id,

          className:
            academicClass.name,

          enrollments:
            enrollmentsByClass.get(
              academicClass.id,
            ) ?? [],

          tariffs:
            tariffsByClass.get(
              academicClass.id,
            ) ?? [],
        }),
    );

  /* -------------------------------------------------------
   * 7. Consola
   * ------------------------------------------------------- */

  console.log('');
  console.log(
    '=========================================================',
  );

  console.log(
    ' RESULTADO POR CLASE',
  );

  console.log(
    '=========================================================',
  );

  for (const analysis of analyses) {
    console.log('');
    console.log(
      `--- ${analysis.className} ---`,
    );

    console.log(
      `Tarifas: ${analysis.tariffCount}`,
    );

    console.log(
      `Enrollments: ${analysis.enrollmentCount}`,
    );

    console.log(
      `Primer enrollment: ${analysis.firstEnrollmentMonth ?? '-'}`,
    );

    console.log(
      `Último enrollment: ${analysis.lastEnrollmentMonth ?? '-'}`,
    );

    console.log(
      `Primera tarifa: ${analysis.firstTariffMonth ?? '-'}`,
    );

    console.log(
      `Última tarifa: ${analysis.lastTariffMonth ?? '-'}`,
    );

    console.log(
      `Meses con enrollment sin tarifa: ${analysis.uncoveredMonthCount}`,
    );

    if (
      analysis.uncoveredMonths.length >
      0
    ) {
      console.log(
        `Huecos: ${analysis.uncoveredMonths.join(', ')}`,
      );
    }
  }

  /* -------------------------------------------------------
   * 8. JSON
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

    historicalCutoff:
      HISTORICAL_CUTOFF,

    source: {
      enrollments:
        ENROLLMENTS_FILE,

      historicalTariffsReady:
        HISTORICAL_TARIFFS_FILE,

      tariffsApi:
        '/tariffs',
    },

    summary: {
      enrollmentCount:
        enrollments.length,

      readyTariffCount:
        readyTariffs.length,

      apiTariffCount:
        apiTariffs.length,

      targetClassCount:
        analyses.length,

      missingInApi:
        sourceComparison.missingInApi.length,

      extraInApi:
        sourceComparison.extraInApi.length,

      totalUncoveredMonths:
        analyses.reduce(
          (sum, item) =>
            sum +
            item.uncoveredMonthCount,
          0,
        ),
    },

    sourceComparison,

    classes:
      analyses,
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
   * 9. XLSX
   * ------------------------------------------------------- */

  const workbook =
    utils.book_new();

  const summaryRows =
    analyses.map(
      (item) => ({
        Clase:
          item.className,

        'Class ID':
          item.classId,

        Tarifas:
          item.tariffCount,

        Enrollments:
          item.enrollmentCount,

        Alumnos:
          item.studentCount,

        'Primer enrollment':
          item.firstEnrollmentMonth,

        'Último enrollment':
          item.lastEnrollmentMonth,

        'Primera tarifa':
          item.firstTariffMonth,

        'Última tarifa':
          item.lastTariffMonth,

        'Meses cubiertos':
          item.coveredMonthCount,

        'Meses sin tarifa':
          item.uncoveredMonthCount,

        'Meses faltantes':
          item.uncoveredMonths.join(
            ' | ',
          ),
      }),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      summaryRows,
    ),
    'Resumen cobertura',
  );

  const tariffRows =
    analyses.flatMap(
      (item) =>
        item.tariffs.map(
          (tariff) => ({
            Clase:
              item.className,

            'Class ID':
              item.classId,

            'Tariff ID':
              tariff.id,

            Tarifa:
              tariff.name,

            Importe:
              tariff.amount,

            Desde:
              tariff.validFrom,

            Hasta:
              tariff.validTo,

            Estado:
              tariff.status,
          }),
        ),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      tariffRows,
    ),
    'Tarifas actuales',
  );

  const gapRows =
    analyses.flatMap(
      (item) =>
        item.uncoveredDetails.map(
          (gap) => ({
            Clase:
              item.className,

            'Class ID':
              item.classId,

            Mes:
              gap.month,

            Enrollments:
              gap.enrollmentCount,

            Alumnos:
              gap.studentCount,
          }),
        ),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      gapRows,
    ),
    'Huecos por mes',
  );

  const gapDetailRows =
    analyses.flatMap(
      (item) =>
        item.uncoveredDetails.flatMap(
          (gap) =>
            gap.enrollments.map(
              (enrollment) => ({
                Clase:
                  item.className,

                'Class ID':
                  item.classId,

                Mes:
                  gap.month,

                Alumno:
                  enrollment.studentName,

                'Student ID':
                  enrollment.studentId,

                'Enrollment ID':
                  enrollment.enrollmentId,

                Estado:
                  enrollment.status,

                Inicio:
                  enrollment.startDate,

                Fin:
                  enrollment.endDate,
              }),
            ),
        ),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      gapDetailRows,
    ),
    'Detalle huecos',
  );

  const missingReadyRows =
    sourceComparison.missingInApi.map(
      (item) => ({
        'Class ID':
          item.classId,

        Tarifa:
          item.name,

        Importe:
          item.amount,

        Desde:
          item.validFrom,

        Hasta:
          item.validTo,
      }),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      missingReadyRows,
    ),
    'Ready faltantes BDD',
  );

  const extraApiRows =
    sourceComparison.extraInApi.map(
      (item) => ({
        'Class ID':
          item.classId,

        Tarifa:
          item.name,

        Importe:
          item.amount,

        Desde:
          item.validFrom,

        Hasta:
          item.validTo,

        Estado:
          item.status,
      }),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      extraApiRows,
    ),
    'Extras BDD',
  );

  const globalSummaryRows = [
    {
      Métrica:
        'Enrollments',

      Valor:
        enrollments.length,
    },
    {
      Métrica:
        'Tarifas ready',

      Valor:
        readyTariffs.length,
    },
    {
      Métrica:
        'Tarifas BDD',

      Valor:
        apiTariffs.length,
    },
    {
      Métrica:
        'Clases objetivo',

      Valor:
        analyses.length,
    },
    {
      Métrica:
        'Ready faltantes en BDD',

      Valor:
        sourceComparison.missingInApi.length,
    },
    {
      Métrica:
        'Extras en BDD',

      Valor:
        sourceComparison.extraInApi.length,
    },
    {
      Métrica:
        'Meses sin cobertura',

      Valor:
        analyses.reduce(
          (sum, item) =>
            sum +
            item.uncoveredMonthCount,
          0,
        ),
    },
  ];

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      globalSummaryRows,
    ),
    'Resumen',
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
  console.log(
    '✅ Análisis finalizado. No se modificó la BDD.',
  );

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