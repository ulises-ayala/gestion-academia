import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';

import xlsx from 'xlsx';

loadEnvFile('.env');

const {
  utils,
  writeFile,
} = xlsx;

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

const ANALYSIS_FILE = path.resolve(
  './exports/no-tariff-classes-analysis.json',
);

const OUTPUT_DIR = path.resolve(
  './exports',
);

const OUTPUT_JSON = path.join(
  OUTPUT_DIR,
  'no-tariff-resolution-plan.json',
);

const OUTPUT_XLSX = path.join(
  OUTPUT_DIR,
  'no-tariff-resolution-plan.xlsx',
);

/*
 * Candidatos de clase destino en la BDD.
 *
 * Esto NO mueve nada.
 * Solamente nos permite comprobar si ya existe
 * una AcademyClass equivalente.
 */
const TARGET_CLASS_CANDIDATES = {
  'S B PAREJAS': [
    'Salsa y Bachata en Pareja',
    'Salsa Y Bachata En Pareja',
    'S&B Parejas',
  ],

  'HELLS': [
    'Heels',
    'Hells',
  ],

  'GRUPO C SOFI': [
    'Clase femenino Sofi',
    'Coreográfico Femenino',
    'Coreografico Femenino',
    'Grupo C. Sofi',
  ],

  'CLASE KIZOMBA': [
    'Clase kizomba',
    'Kizomba',
  ],

  'COREOGRAFICO E MASC BACHATA URBAN': [
    'Coreografico E.Masc-Bachata/Urban',
    'Urban Flow',
  ],

  'FORMACION DOCENTE EN RITMOS CARIBENOS Y KIZOMBA': [
    'Formacion Docente En Ritmos Caribeños Y Kizomba',
  ],

  'INST SUP COREOGRAFICO TANGO 18 MESES': [
    'Inst.Sup.Coreografico -Tango /18 Meses',
  ],

  'ARABASHE': [
    'arabashe',
  ],
};

/* =========================================================
 * HELPERS
 * ========================================================= */

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  return String(value)
    .slice(0, 10);
}

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

  if (!Number.isFinite(number)) {
    return null;
  }

  return number.toFixed(2);
}

async function readJson(file) {
  const raw =
    await fs.readFile(
      file,
      'utf8',
    );

  return JSON.parse(raw);
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
 * CLASES
 * ========================================================= */

async function getAllClasses(
  sessionCookie,
) {
  const all = [];

  let page = 1;
  const pageSize = 100;

  while (true) {
    const response =
      await apiJson(
        `/classes?page=${page}&pageSize=${pageSize}`,
        sessionCookie,
      );

    const items =
      Array.isArray(response)
        ? response
        : response.items ?? [];

    all.push(
      ...items,
    );

    if (
      Array.isArray(response)
    ) {
      break;
    }

    if (
      items.length <
      pageSize
    ) {
      break;
    }

    page++;
  }

  return all;
}

function indexClassesByName(
  classes,
) {
  const map =
    new Map();

  for (
    const academicClass
    of classes
  ) {
    const key =
      normalizeText(
        academicClass.name,
      );

    if (
      !map.has(key)
    ) {
      map.set(
        key,
        [],
      );
    }

    map
      .get(key)
      .push(
        academicClass,
      );
  }

  return map;
}

function findTargetClasses(
  sourceClassName,
  classIndex,
) {
  const key =
    normalizeText(
      sourceClassName,
    );

  const candidates =
    TARGET_CLASS_CANDIDATES[
      key
    ] ?? [];

  const found = [];

  for (
    const candidate
    of candidates
  ) {
    const matches =
      classIndex.get(
        normalizeText(
          candidate,
        ),
      ) ?? [];

    for (
      const match
      of matches
    ) {
      if (
        !found.some(
          (item) =>
            item.id ===
            match.id,
        )
      ) {
        found.push(
          match,
        );
      }
    }
  }

  return found;
}

/* =========================================================
 * TARIFAS
 * ========================================================= */

function indexTariffsByClass(
  tariffs,
) {
  const map =
    new Map();

  for (
    const tariff
    of tariffs
  ) {
    if (
      !tariff.classId
    ) {
      continue;
    }

    if (
      !map.has(
        tariff.classId,
      )
    ) {
      map.set(
        tariff.classId,
        [],
      );
    }

    map
      .get(
        tariff.classId,
      )
      .push(
        tariff,
      );
  }

  return map;
}

/* =========================================================
 * RESOLUTION LOGIC
 * ========================================================= */

function resolveSameActivityPlan({
  analysis,
  sourceClass,
  targetClasses,
}) {
  const distinctTargets =
    targetClasses.filter(
      (item) =>
        item.id !==
        sourceClass?.id,
    );

  /*
   * Existe otra AcademyClass claramente equivalente.
   *
   * Conviene revisar mover enrollments a esa entidad
   * en vez de duplicar tarifas.
   */
  if (
    distinctTargets.length === 1
  ) {
    return {
      resolution:
        'MOVE_ENROLLMENTS_TO_EXISTING_CLASS',

      targetClass:
        distinctTargets[0],

      requiresManualReview:
        false,

      reason:
        'El PO confirmó que es la misma actividad y existe otra AcademyClass equivalente en la BDD.',
    };
  }

  if (
    distinctTargets.length > 1
  ) {
    return {
      resolution:
        'AMBIGUOUS_TARGET_CLASS',

      targetClass:
        null,

      requiresManualReview:
        true,

      reason:
        'El PO confirmó equivalencia, pero hay más de una AcademyClass candidata en la BDD.',
    };
  }

  /*
   * No existe otra clase destino.
   *
   * Entonces probablemente estamos ante la misma
   * entidad actual y solo debemos reconstruir su
   * historia tarifaria usando el mapping confirmado.
   */
  return {
    resolution:
      'KEEP_CLASS_REUSE_HISTORICAL_PATTERN',

    targetClass:
      sourceClass ?? null,

    requiresManualReview:
      false,

    reason:
      'El PO confirmó equivalencia histórica, pero no existe otra AcademyClass distinta a la cual mover enrollments.',
  };
}

function resolveHistoricalActivityPlan({
  analysis,
  sourceClass,
}) {
  return {
    resolution:
      analysis.confirmedMapping
        ?.tariffPolicy ===
        'GENERAL_ACADEMY_RATE'
        ? 'BUILD_GENERAL_RATE_TARIFFS'
        : 'BUILD_HISTORICAL_TARIFFS',

    targetClass:
      sourceClass ?? null,

    requiresManualReview:
      false,

    reason:
      analysis.confirmedMapping
        ?.reason ??
      'Actividad histórica confirmada por PO.',
  };
}

function resolveSpecialProgramPlan({
  analysis,
  sourceClass,
}) {
  const mapping =
    analysis.confirmedMapping ??
    {};

  if (
    mapping.baseAmount &&
    mapping.validFrom &&
    mapping.validTo
  ) {
    return {
      resolution:
        'BUILD_SPECIAL_PROGRAM_TARIFF',

      targetClass:
        sourceClass ?? null,

      requiresManualReview:
        false,

      specialTariff: {
        amount:
          normalizeAmount(
            mapping.baseAmount,
          ),

        validFrom:
          normalizeDate(
            mapping.validFrom,
          ),

        validTo:
          normalizeDate(
            mapping.validTo,
          ),
      },

      reason:
        mapping.reason,
    };
  }

  if (
    mapping.baseAmount
  ) {
    return {
      resolution:
        'SPECIAL_PROGRAM_PERIOD_MISSING',

      targetClass:
        sourceClass ?? null,

      requiresManualReview:
        true,

      specialTariff: {
        amount:
          normalizeAmount(
            mapping.baseAmount,
          ),

        validFrom:
          normalizeDate(
            mapping.validFrom,
          ),

        validTo:
          normalizeDate(
            mapping.validTo,
          ),
      },

      reason:
        'La tarifa base está confirmada, pero falta definir completamente el período de vigencia.',
    };
  }

  return {
    resolution:
      'SPECIAL_PROGRAM_REVIEW',

    targetClass:
      sourceClass ?? null,

    requiresManualReview:
      true,

    reason:
      'Programa especial sin información tarifaria suficiente.',
  };
}

function buildResolutionPlan({
  analysis,
  classesById,
  classIndex,
  tariffsByClass,
}) {
  const sourceClass =
    classesById.get(
      analysis.classId,
    ) ??
    null;

  const targetClasses =
    findTargetClasses(
      analysis.className,
      classIndex,
    );

  const mapping =
    analysis.confirmedMapping ??
    null;

  let plan;

  switch (
    mapping?.targetType
  ) {
    case 'TEST_CLASS':
      plan = {
        resolution:
          'IGNORE_TEST_CLASS',

        targetClass:
          sourceClass,

        requiresManualReview:
          false,

        reason:
          mapping.reason,
      };

      break;

    case 'SAME_ACTIVITY':
      plan =
        resolveSameActivityPlan({
          analysis,
          sourceClass,
          targetClasses,
        });

      break;

    case 'HISTORICAL_ACTIVITY':
      plan =
        resolveHistoricalActivityPlan({
          analysis,
          sourceClass,
        });

      break;

    case 'SPECIAL_PROGRAM':
      plan =
        resolveSpecialProgramPlan({
          analysis,
          sourceClass,
        });

      break;

    default:
      plan = {
        resolution:
          'UNRESOLVED',

        targetClass:
          null,

        requiresManualReview:
          true,

        reason:
          'No existe un mapping confirmado para esta clase.',
      };
  }

  const sourceTariffs =
    sourceClass
      ? tariffsByClass.get(
          sourceClass.id,
        ) ?? []
      : [];

  const targetTariffs =
    plan.targetClass
      ? tariffsByClass.get(
          plan.targetClass.id,
        ) ?? []
      : [];

  return {
    sourceClassId:
      analysis.classId,

    sourceClassName:
      analysis.className,

    sourceClassFound:
      Boolean(
        sourceClass,
      ),

    sourceClass:
      sourceClass
        ? {
            id:
              sourceClass.id,

            name:
              sourceClass.name,

            status:
              sourceClass.status ??
              null,
          }
        : null,

    enrollmentCount:
      analysis.enrollmentCount,

    studentCount:
      analysis.studentCount,

    firstStartDate:
      analysis.firstStartDate,

    lastStartDate:
      analysis.lastStartDate,

    diagnosis:
      analysis.diagnosis,

    mappingType:
      mapping?.targetType ??
      null,

    historicalNames:
      mapping?.historicalNames ??
      [],

    tariffPolicy:
      mapping?.tariffPolicy ??
      null,

    confirmedBaseAmount:
      normalizeAmount(
        mapping?.baseAmount,
      ),

    confirmedValidFrom:
      normalizeDate(
        mapping?.validFrom,
      ),

    confirmedValidTo:
      normalizeDate(
        mapping?.validTo,
      ),

    targetCandidates:
      targetClasses.map(
        (item) => ({
          id:
            item.id,

          name:
            item.name,

          status:
            item.status ??
            null,
        }),
      ),

    resolution:
      plan.resolution,

    resolutionReason:
      plan.reason,

    requiresManualReview:
      plan.requiresManualReview,

    targetClass:
      plan.targetClass
        ? {
            id:
              plan.targetClass.id,

            name:
              plan.targetClass.name,

            status:
              plan.targetClass.status ??
              null,
          }
        : null,

    specialTariff:
      plan.specialTariff ??
      null,

    sourceTariffCount:
      sourceTariffs.length,

    targetTariffCount:
      targetTariffs.length,

    targetTariffs:
      targetTariffs.map(
        (tariff) => ({
          id:
            tariff.id,

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

          status:
            tariff.status,
        }),
      ),
  };
}

/* =========================================================
 * RESUMEN
 * ========================================================= */

function countBy(
  items,
  keyFn,
) {
  const map =
    new Map();

  for (
    const item
    of items
  ) {
    const key =
      keyFn(item) ??
      'UNKNOWN';

    map.set(
      key,
      (map.get(key) ?? 0) + 1,
    );
  }

  return [
    ...map.entries(),
  ]
    .map(
      ([key, count]) => ({
        key,
        count,
      }),
    )
    .sort(
      (a, b) =>
        b.count - a.count,
    );
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
    ' PLAN DE RESOLUCIÓN DE CLASES SIN TARIFA',
  );

  console.log(
    '=========================================================',
  );

  console.log('');

  console.log(
    `📄 Análisis: ${ANALYSIS_FILE}`,
  );

  /* =======================================================
   * CARGA
   * ======================================================= */

  const analysis =
    await readJson(
      ANALYSIS_FILE,
    );

  const classesAnalysis =
    analysis.classes ??
    [];

  if (
    !Array.isArray(
      classesAnalysis,
    )
  ) {
    throw new Error(
      'no-tariff-classes-analysis.json no contiene classes.',
    );
  }

  console.log(
    `📋 Clases analizadas: ${classesAnalysis.length}`,
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
   * BDD
   * ======================================================= */

  const classes =
    await getAllClasses(
      sessionCookie,
    );

  const tariffs =
    await apiJson(
      '/tariffs',
      sessionCookie,
    );

  if (
    !Array.isArray(
      tariffs,
    )
  ) {
    throw new Error(
      'GET /tariffs no devolvió un array.',
    );
  }

  console.log(
    `💃 Clases en BDD: ${classes.length}`,
  );

  console.log(
    `💰 Tarifas en BDD: ${tariffs.length}`,
  );

  /* =======================================================
   * ÍNDICES
   * ======================================================= */

  const classesById =
    new Map(
      classes.map(
        (item) => [
          item.id,
          item,
        ],
      ),
    );

  const classIndex =
    indexClassesByName(
      classes,
    );

  const tariffsByClass =
    indexTariffsByClass(
      tariffs,
    );

  /* =======================================================
   * PLAN
   * ======================================================= */

  const plans =
    classesAnalysis.map(
      (item) =>
        buildResolutionPlan({
          analysis:
            item,

          classesById,

          classIndex,

          tariffsByClass,
        }),
    );

  const actionablePlans =
    plans.filter(
      (item) =>
        item.resolution !==
        'IGNORE_TEST_CLASS',
    );

  const ignoredPlans =
    plans.filter(
      (item) =>
        item.resolution ===
        'IGNORE_TEST_CLASS',
    );

  const manualReviewPlans =
    actionablePlans.filter(
      (item) =>
        item.requiresManualReview,
    );

  const resolutionSummary =
    countBy(
      plans,
      (item) =>
        item.resolution,
    );

  /* =======================================================
   * CONSOLA
   * ======================================================= */

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

  console.log('');
  console.log(
    `🎯 Clases reales para resolver: ${actionablePlans.length}`,
  );

  console.log(
    `🧪 Clases de prueba ignoradas: ${ignoredPlans.length}`,
  );

  console.log(
    `⚠️ Requieren revisión manual: ${manualReviewPlans.length}`,
  );

  console.log('');
  console.log(
    '--- RESOLUCIONES ---',
  );

  for (
    const item
    of resolutionSummary
  ) {
    console.log(
      `${item.key}: ${item.count}`,
    );
  }

  for (
    const item
    of plans
  ) {
    console.log('');
    console.log(
      `--- ${item.sourceClassName} ---`,
    );

    console.log(
      `Class ID: ${item.sourceClassId}`,
    );

    console.log(
      `Enrollments: ${item.enrollmentCount}`,
    );

    console.log(
      `Diagnóstico: ${item.diagnosis}`,
    );

    console.log(
      `Resolución: ${item.resolution}`,
    );

    console.log(
      `Revisión manual: ${
        item.requiresManualReview
          ? 'SÍ'
          : 'NO'
      }`,
    );

    if (
      item.targetCandidates.length >
      0
    ) {
      console.log(
        'Clases candidatas en BDD:',
      );

      for (
        const candidate
        of item.targetCandidates
      ) {
        console.log(
          `  - ${candidate.name} | ${candidate.id}`,
        );
      }
    }

    if (
      item.targetClass
    ) {
      console.log(
        `Clase destino: ${item.targetClass.name} | ${item.targetClass.id}`,
      );

      console.log(
        `Tarifas destino existentes: ${item.targetTariffCount}`,
      );
    }

    if (
      item.tariffPolicy
    ) {
      console.log(
        `Política tarifaria: ${item.tariffPolicy}`,
      );
    }

    if (
      item.specialTariff
    ) {
      console.log(
        `Tarifa especial: $${item.specialTariff.amount ?? '-'}`,
      );

      console.log(
        `Vigencia: ${item.specialTariff.validFrom ?? '?'} → ${item.specialTariff.validTo ?? '?'}`,
      );
    }

    console.log(
      `Motivo: ${item.resolutionReason}`,
    );
  }

  /* =======================================================
   * OUTPUT JSON
   * ======================================================= */

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
      ANALYSIS_FILE,

    summary: {
      analyzedClasses:
        plans.length,

      actionableClasses:
        actionablePlans.length,

      ignoredTestClasses:
        ignoredPlans.length,

      manualReviewClasses:
        manualReviewPlans.length,

      resolutions:
        resolutionSummary,
    },

    plans,
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

  /* =======================================================
   * XLSX
   * ======================================================= */

  const workbook =
    utils.book_new();

  const planRows =
    plans.map(
      (item) => ({
        'Clase actual':
          item.sourceClassName,

        'Class ID actual':
          item.sourceClassId,

        Enrollments:
          item.enrollmentCount,

        Alumnos:
          item.studentCount,

        Diagnóstico:
          item.diagnosis,

        'Tipo mapping':
          item.mappingType,

        Resolución:
          item.resolution,

        'Requiere revisión manual':
          item.requiresManualReview
            ? 'SI'
            : 'NO',

        'Clase destino':
          item.targetClass?.name ??
          '',

        'Class ID destino':
          item.targetClass?.id ??
          '',

        'Tarifas destino':
          item.targetTariffCount,

        'Política tarifaria':
          item.tariffPolicy ??
          '',

        'Tarifa base confirmada':
          item.confirmedBaseAmount ??
          '',

        'Vigencia confirmada desde':
          item.confirmedValidFrom ??
          '',

        'Vigencia confirmada hasta':
          item.confirmedValidTo ??
          '',

        Motivo:
          item.resolutionReason,
      }),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      planRows,
    ),
    'Plan',
  );

  const candidateRows =
    plans.flatMap(
      (item) =>
        item.targetCandidates.map(
          (candidate) => ({
            'Clase origen':
              item.sourceClassName,

            'Class ID origen':
              item.sourceClassId,

            'Clase candidata':
              candidate.name,

            'Class ID candidata':
              candidate.id,

            Estado:
              candidate.status,
          }),
        ),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      candidateRows,
    ),
    'Clases candidatas',
  );

  const targetTariffRows =
    plans.flatMap(
      (item) =>
        item.targetTariffs.map(
          (tariff) => ({
            'Clase origen':
              item.sourceClassName,

            'Clase destino':
              item.targetClass?.name ??
              '',

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
      targetTariffRows,
    ),
    'Tarifas destino',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      resolutionSummary.map(
        (item) => ({
          Resolución:
            item.key,

          Cantidad:
            item.count,
        }),
      ),
    ),
    'Resumen',
  );

  writeFile(
    workbook,
    OUTPUT_XLSX,
  );

  /* =======================================================
   * FINAL
   * ======================================================= */

  console.log('');

  console.log(
    `📝 JSON: ${OUTPUT_JSON}`,
  );

  console.log(
    `📊 Excel: ${OUTPUT_XLSX}`,
  );

  console.log('');

  console.log(
    '✅ Plan generado. No se modificó la BDD.',
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
      '❌ ERROR:',
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