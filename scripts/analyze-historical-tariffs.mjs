import fs from 'node:fs/promises';
import path from 'node:path';

import xlsx from 'xlsx';

const {
  readFile,
  utils,
  writeFile,
} = xlsx;

/* =========================================================
 * CONFIG
 * ========================================================= */

const INPUT_FILE = path.resolve(
  './scripts/data/Historial_Carmesi_2025_2026_NORMALIZADO.xlsx',
);

const CLASSES_FILE = path.resolve(
  './exports/classes-current.json',
);

const OUTPUT_DIR = path.resolve(
  './exports',
);

const OUTPUT_JSON = path.join(
  OUTPUT_DIR,
  'historical-tariffs-analysis.json',
);

const OUTPUT_XLSX = path.join(
  OUTPUT_DIR,
  'historical-tariffs-analysis.xlsx',
);

/* =========================================================
 * NORMALIZACIÓN
 * ========================================================= */

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function normalizeTeacher(value) {
  const normalized =
    normalizeText(value);

  const aliases = {
    SOFI: 'SOFIA',
    VIRGI: 'VIRGINIA',
  };

  return (
    aliases[normalized] ??
    normalized
  );
}

/* =========================================================
 * MAPEOS SEGUROS
 *
 * Solo ponemos aquí equivalencias que ya conocemos.
 * Los casos dudosos deben quedar para revisión manual.
 * ========================================================= */
const PRICE_DECISIONS = {
  /*
   * Julio 2026:
   * $15.000 fue medio mes / condición especial.
   * No representa el valor normal de la cuota.
   */

  'BACHATA Y SALSA INICIAL | JOSELO | 2026-07': {
    decision: 'NOT_A_TARIFF',
    reason: 'Medio mes o condición especial',
  },

  'COREOGRAFICO FEMENINO | SOFIA | 2026-07': {
    decision: 'NOT_A_TARIFF',
    reason: 'Medio mes o condición especial',
  },

  'ESTILO FEMENINO | SOFIA | 2026-07': {
    decision: 'NOT_A_TARIFF',
    reason: 'Medio mes o condición especial',
  },

  'INFANTIL | SOFIA | 2026-07': {
    decision: 'NOT_A_TARIFF',
    reason: 'Medio mes o condición especial',
  },

  'KIDS | SOFIA | 2026-07': {
    decision: 'NOT_A_TARIFF',
    reason: 'Medio mes o condición especial',
  },

  'MAMBO EN PAREJA | FER | 2026-07': {
    decision: 'NOT_A_TARIFF',
    reason: 'Medio mes o condición especial',
  },

  'TANGO AVANZADO INTERMEDIO | ROBERTO | 2026-07': {
    decision: 'NOT_A_TARIFF',
    reason: 'Medio mes o condición especial',
  },

  'TEENS | SOFIA | 2026-07': {
    decision: 'NOT_A_TARIFF',
    reason: 'Medio mes o condición especial',
  },

  'ZUMBA | JOSELO | 2026-07': {
    decision: 'NOT_A_TARIFF',
    reason: 'Medio mes o condición especial',
  },

  /*
   * Confirmado como cambio real de tarifa.
   */
  'BACHATA Y SALSA INICIAL | JOSELO | 2026-08': {
    decision: 'CONFIRMED',
    amount: '40000.00',
    reason: 'Desde agosto de 2026 la cuota normal pasó a $40.000',
  },

  /*
   * Condiciones especiales individuales.
   */
  'COREOGRAFICO BACHATA EN PAREJA | KEVIN | 2025-07': {
    decision: 'NOT_A_TARIFF',
    reason: 'Condición especial definida por el profesor',
  },

  'SALSA INICIAL SIESTA | JAVI | 2025-09': {
    decision: 'NOT_A_TARIFF',
    reason: 'Condición especial definida por el profesor',
  },
};
const CLASS_NAME_MAP = {
  'BACHATA Y SALSA INICIAL':
    'Bachata y Salsa Inicial',

  'LADYS KIZZ':
    'Ladys Kizz',

  'LADYS TRAINING':
    'Clase LT - A.Frank',

  'STREET COREOGRAFICO ADULTO':
    'S.C Adultos (+18 años)',

  'STREET COREOGRAFICO AVANZADO INTERMEDIO':
    'Street Int/Avanzado',

  'STREET COREOGRAFICO JUVENIL':
    'S.C Juvenil (12-17 años)',

  'TANGO AVANZADO INTERMEDIO':
    'Tango (Inter/Avanz)',

  'ARABE INFANTIL':
    'Árabe infantil',

  'MAMBO EN PAREJA':
    'Mambo en parejas',

  'TEENS':
    'Teens (8 a 12 años)',

  'ZUMBA':
    'Zumba - Profe Joselo',

  'KIDS':
    'Kids 4-5 años',

    

};

/*
 * Si después confirmamos casos que dependen también
 * del profesor, podemos cargarlos acá.
 *
 * Formato:
 *
 * "ACTIVIDAD | PROFESOR": "Clase Carmesí"
 */
const CLASS_ACTIVITY_TEACHER_MAP = {
  /*
   * Sofía
   */
  'ESTILO FEMENINO | SOFIA':
    'Clase femenino Sofi',

  'COREOGRAFICO FEMENINO | SOFIA':
    'Clase femenino Sofi',

  /*
   * Infantil
   */
  'INFANTIL | SOFIA':
    'Infantil (6 a 7 años)',

  /*
   * Ana Frank
   */
  'ESTILO FRANK | ANA':
    'Grupo C. - A.Frank',

  /*
   * Tango
   */
  'TANGO | ROBERTO':
    'Tango (Inter/Avanz)',

  /*
   * Ritmos / Kizomba
   */
  'RITMOS CARIBENOS Y KIZOMBA PAREJAS | FABI':
    'Ritmos latinos y caribeños',

  /*
   * Siesta
   */
  'SALSA INICIAL SIESTA | JAVI':
    'Bachata y Salsa Inicial',

  'BACHATA INICIAL SIESTA | JAVI':
    'Bachata y Salsa Inicial',
    
    'INFANTIL | SANTY':
    'S.C Infantil (6-11 años)',
};

/* =========================================================
 * HELPERS
 * ========================================================= */

async function readJson(file) {
  return JSON.parse(
    await fs.readFile(
      file,
      'utf8',
    ),
  );
}

function excelDateToIso(value) {
  if (!value) {
    return null;
  }

  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime(),
    )
  ) {
    return value
      .toISOString()
      .slice(0, 10);
  }

  /*
   * xlsx puede devolver fechas como strings.
   */
  const stringValue =
    String(value).trim();

  if (
    /^\d{4}-\d{2}-\d{2}/.test(
      stringValue,
    )
  ) {
    return stringValue.slice(
      0,
      10,
    );
  }

  /*
   * También puede devolver serial de Excel.
   */
  if (
    typeof value === 'number'
  ) {
    const parsed =
      xlsx.SSF.parse_date_code(
        value,
      );

    if (parsed) {
      return [
        parsed.y,
        String(parsed.m)
          .padStart(2, '0'),
        String(parsed.d)
          .padStart(2, '0'),
      ].join('-');
    }
  }

  return null;
}

function decimal(value) {
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
    !Number.isFinite(number)
  ) {
    return null;
  }

  return number.toFixed(2);
}

/* =========================================================
 * SIMILARIDAD
 *
 * Solo sirve para sugerencias.
 * Nunca crea un match automático.
 * ========================================================= */

function tokens(value) {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter(Boolean),
  );
}

function similarity(a, b) {
  const left =
    tokens(a);

  const right =
    tokens(b);

  if (
    left.size === 0 ||
    right.size === 0
  ) {
    return 0;
  }

  let intersection = 0;

  for (
    const token
    of left
  ) {
    if (
      right.has(token)
    ) {
      intersection++;
    }
  }

  const union =
    new Set([
      ...left,
      ...right,
    ]).size;

  return intersection / union;
}

function tariffDecisionKey(
  activity,
  teacher,
  validFrom,
) {
  if (!validFrom) {
    return null;
  }

  const period =
    validFrom.slice(0, 7);

  return [
    normalizeText(activity),
    normalizeTeacher(teacher),
    period,
  ].join(' | ');
}

function resolvePriceDecision({
  activity,
  teacher,
  validFrom,
  amount,
}) {
  if (!validFrom) {
    return null;
  }

  const period =
    validFrom.slice(0, 7);

  /*
   * REGLA GENERAL CONFIRMADA POR LA ACADEMIA:
   * desde agosto 2026 la cuota normal pasa a $40.000.
   */
  if (period === '2026-08') {
    return {
      decision: 'CONFIRMED',
      amount: '40000.00',
      reason:
        'La academia confirmó que desde agosto de 2026 la cuota normal pasó a $40.000.',
    };
  }

  /*
   * Para el resto, buscamos las decisiones específicas.
   */
  const decisionKey =
    tariffDecisionKey(
      activity,
      teacher,
      validFrom,
    );

  return (
    PRICE_DECISIONS[
      decisionKey
    ] ?? null
  );
}

function suggestClasses(
  activity,
  classes,
  limit = 3,
) {
  return classes
    .map(
      (academicClass) => ({
        id:
          academicClass.id,

        name:
          academicClass.name,

        status:
          academicClass.status,

        score:
          similarity(
            activity,
            academicClass.name,
          ),
      }),
    )
    .filter(
      (candidate) =>
        candidate.score > 0,
    )
    .sort(
      (a, b) =>
        b.score - a.score,
    )
    .slice(
      0,
      limit,
    );
}

/* =========================================================
 * RESOLUCIÓN DE CLASE
 * ========================================================= */

function buildClassIndexes(
  classes,
) {
  const byId =
    new Map();

  const byName =
    new Map();

  for (
    const academicClass
    of classes
  ) {
    if (
      !academicClass.id ||
      !academicClass.name
    ) {
      continue;
    }

    byId.set(
      academicClass.id,
      academicClass,
    );

    const key =
      normalizeText(
        academicClass.name,
      );

    if (
      !byName.has(key)
    ) {
      byName.set(
        key,
        [],
      );
    }

    byName
      .get(key)
      .push(
        academicClass,
      );
  }

  return {
    byId,
    byName,
  };
}

function resolveClass({
  activity,
  teacher,
  classes,
  byName,
}) {
  const activityKey =
    normalizeText(activity);

  const teacherKey =
    normalizeTeacher(teacher);

  /*
   * 1. Mapping explícito por actividad + profesor.
   */
  const activityTeacherKey =
    `${activityKey} | ${teacherKey}`;

  const explicitByTeacher =
    CLASS_ACTIVITY_TEACHER_MAP[
      activityTeacherKey
    ];

  if (
    explicitByTeacher
  ) {
    const matches =
      byName.get(
        normalizeText(
          explicitByTeacher,
        ),
      ) ?? [];

    if (
      matches.length === 1
    ) {
      return {
        academicClass:
          matches[0],

        matchType:
          'MANUAL_ACTIVITY_TEACHER',

        confidence:
          'HIGH',

        suggestions:
          [],
      };
    }
  }

  /*
   * 2. Mapping explícito solo por actividad.
   */
  const mappedName =
    CLASS_NAME_MAP[
      activityKey
    ];

  if (
    mappedName
  ) {
    const matches =
      byName.get(
        normalizeText(
          mappedName,
        ),
      ) ?? [];

    if (
      matches.length === 1
    ) {
      return {
        academicClass:
          matches[0],

        matchType:
          'MANUAL_ACTIVITY',

        confidence:
          'HIGH',

        suggestions:
          [],
      };
    }

    if (
      matches.length > 1
    ) {
      return {
        academicClass:
          null,

        matchType:
          'AMBIGUOUS_MANUAL_MATCH',

        confidence:
          'LOW',

        suggestions:
          matches.map(
            (item) => ({
              id:
                item.id,

              name:
                item.name,

              status:
                item.status,

              score:
                1,
            }),
          ),
      };
    }
  }

  /*
   * 3. Coincidencia exacta normalizada.
   */
  const exact =
    byName.get(
      activityKey,
    ) ?? [];

  if (
    exact.length === 1
  ) {
    return {
      academicClass:
        exact[0],

      matchType:
        'EXACT_NAME',

      confidence:
        'HIGH',

      suggestions:
        [],
    };
  }

  if (
    exact.length > 1
  ) {
    return {
      academicClass:
        null,

      matchType:
        'AMBIGUOUS_EXACT_NAME',

      confidence:
        'LOW',

      suggestions:
        exact.map(
          (item) => ({
            id:
              item.id,

            name:
              item.name,

            status:
              item.status,

            score:
              1,
          }),
        ),
    };
  }

  /*
   * 4. No hacemos fuzzy automático.
   * Solamente mostramos sugerencias.
   */
  return {
    academicClass:
      null,

    matchType:
      'NO_MATCH',

    confidence:
      'LOW',

    suggestions:
      suggestClasses(
        activity,
        classes,
      ),
  };
}

/* =========================================================
 * ESTADO DE REVISIÓN DE TARIFA
 * ========================================================= */

function classifyTariff({
  sourceConfidence,
  sourceReview,
  academicClass,
}) {
  const confidence =
    normalizeText(
      sourceConfidence,
    );

  const review =
    normalizeText(
      sourceReview,
    );

  const classMissing =
    !academicClass;

  const priceNeedsReview =
    confidence === 'BAJA' ||
    review.includes(
      'REVISAR',
    );

  if (
    classMissing &&
    priceNeedsReview
  ) {
    return 'REVIEW_CLASS_AND_PRICE';
  }

  if (
    classMissing
  ) {
    return 'REVIEW_CLASS';
  }

  if (
    priceNeedsReview
  ) {
    return 'REVIEW_PRICE';
  }

  return 'OK';
}

/* =========================================================
 * MAIN
 * ========================================================= */

async function main() {
  console.log('');
  console.log(
    '📥 Leyendo historial normalizado...',
  );

  console.log(
    `📄 ${INPUT_FILE}`,
  );

  const workbook =
    readFile(
      INPUT_FILE,
      {
        cellDates: true,
      },
    );

  const sheet =
    workbook.Sheets[
      'Tarifas candidatas'
    ];

  if (!sheet) {
    throw new Error(
      'No existe la hoja "Tarifas candidatas".',
    );
  }

  const rows =
    utils.sheet_to_json(
      sheet,
      {
        defval: null,
        raw: true,
      },
    );

  console.log(
    `💰 Períodos tarifarios candidatos: ${rows.length}`,
  );

  console.log('');
  console.log(
    '📥 Leyendo catálogo de clases...',
  );

  const classes =
    await readJson(
      CLASSES_FILE,
    );

  console.log(
    `💃 Clases disponibles: ${classes.length}`,
  );

  const {
    byName,
  } =
    buildClassIndexes(
      classes,
    );

  const analysis = [];

  for (
    const row
    of rows
  ) {
    const activity =
      row[
        'Actividad normalizada'
      ];

    const teacher =
      row[
        'Profesor normalizado'
      ];

      const validFrom =
        excelDateToIso(
          row['Vigencia desde'],
        );

      const validTo =
        excelDateToIso(
          row['Vigencia hasta'],
        );

    const candidateAmount =
      decimal(
        row['Importe candidato'],
      );

    const priceDecision =
      resolvePriceDecision({
        activity,
        teacher,
        validFrom,
        amount: candidateAmount,
      });

    const classMatch =
      resolveClass({
        activity,
        teacher,
        classes,
        byName,
      });

    const academicClass =
      classMatch.academicClass;

    const sourceConfidence =
      row.Confianza;

    const sourceReview =
      row['Revisión'];

    const result =
      classifyTariff({
        sourceConfidence,
        sourceReview,
        academicClass,
      });

    analysis.push({
      activity,
      teacher,

      classId:
        academicClass?.id ??
        null,

      className:
        academicClass?.name ??
        null,

      classStatus:
        academicClass?.status ??
        null,

      classMatchType:
        classMatch.matchType,

      classMatchConfidence:
        classMatch.confidence,

validFrom,

validTo,

amount:
  priceDecision?.amount ??
  candidateAmount,

priceDecision:
  priceDecision?.decision ??
  null,

priceDecisionReason:
  priceDecision?.reason ??
  null,

result:
  priceDecision?.decision ===
  'NOT_A_TARIFF'
    ? 'NOT_A_TARIFF'
    : priceDecision?.decision ===
        'CONFIRMED' &&
      academicClass
      ? 'OK'
      : result,

      months:
        Number(
          row[
            'Meses consecutivos'
          ] ?? 0,
        ),

      sourceConfidence,
      sourceReview,
      sourceRows:
        row['Filas origen'] ??
        null,
      suggestions:
        classMatch.suggestions,
    });
  }

  /* =======================================================
   * CONTADORES
   * ======================================================= */

  const counts =
    analysis.reduce(
      (acc, item) => {
        acc[item.result] =
          (
            acc[
              item.result
            ] ?? 0
          ) + 1;

        return acc;
      },
      {},
    );

  console.log('');
  console.log(
    '📊 RESULTADO DEL ANÁLISIS',
  );

  console.log(
    `✅ OK: ${
      counts.OK ?? 0
    }`,
  );

  console.log(
    `💲 Revisar precio: ${
      counts.REVIEW_PRICE ??
      0
    }`,
  );

  console.log(
    `💃 Revisar clase: ${
      counts.REVIEW_CLASS ??
      0
    }`,
  );

  console.log(
    `⚠️ Revisar clase y precio: ${
      counts.REVIEW_CLASS_AND_PRICE ??
      0
    }`,
  );
  console.log(
    `🚫 No son tarifa: ${
      counts.NOT_A_TARIFF ?? 0
    }`,
  );
  /* =======================================================
   * JSON
   * ======================================================= */

  await fs.mkdir(
    OUTPUT_DIR,
    {
      recursive: true,
    },
  );

  await fs.writeFile(
    OUTPUT_JSON,
    JSON.stringify(
      {
        generatedAt:
          new Date()
            .toISOString(),

        source:
          INPUT_FILE,

        classesSource:
          CLASSES_FILE,

        summary: {
          total:
            analysis.length,

          ...counts,
        },

        items:
          analysis,
      },
      null,
      2,
    ),
    'utf8',
  );

  /* =======================================================
   * XLSX
   * ======================================================= */

  const workbookOut =
    utils.book_new();

  const reportRows =
    analysis.map(
      (item) => ({
        Resultado:
          item.result,

        Actividad:
          item.activity,

        Profesor:
          item.teacher,

        'Clase Carmesí':
          item.className,

        'Class ID':
          item.classId,

        'Estado clase':
          item.classStatus,

        'Tipo match':
          item.classMatchType,

        'Confianza match':
          item.classMatchConfidence,

        'Vigencia desde':
          item.validFrom,

        'Vigencia hasta':
          item.validTo,

        'Importe candidato':
          item.amount,

        'Meses consecutivos':
          item.months,

        'Confianza precio':
          item.sourceConfidence,

        'Revisión precio':
          item.sourceReview,

        'Filas origen':
          item.sourceRows,

        'Sugerencia 1':
          item.suggestions[0]
            ?.name ??
          null,

        'Sugerencia 2':
          item.suggestions[1]
            ?.name ??
          null,

        'Sugerencia 3':
          item.suggestions[2]
            ?.name ??
          null,
      }),
    );

  utils.book_append_sheet(
    workbookOut,
    utils.json_to_sheet(
      reportRows,
    ),
    'Analisis',
  );

  utils.book_append_sheet(
    workbookOut,
    utils.json_to_sheet(
      analysis
        .filter(
          (item) =>
            item.result ===
              'REVIEW_CLASS' ||
            item.result ===
              'REVIEW_CLASS_AND_PRICE',
        )
        .map(
          (item) => ({
            Actividad:
              item.activity,

            Profesor:
              item.teacher,

            'Importe candidato':
              item.amount,

            'Vigencia desde':
              item.validFrom,

            'Sugerencia 1':
              item.suggestions[0]
                ?.name ??
              null,

            'Score 1':
              item.suggestions[0]
                ?.score ??
              null,

            'Sugerencia 2':
              item.suggestions[1]
                ?.name ??
              null,

            'Score 2':
              item.suggestions[1]
                ?.score ??
              null,

            'Sugerencia 3':
              item.suggestions[2]
                ?.name ??
              null,

            'Score 3':
              item.suggestions[2]
                ?.score ??
              null,
          }),
        ),
    ),
    'Revisar clases',
  );

  utils.book_append_sheet(
    workbookOut,
    utils.json_to_sheet(
      analysis
        .filter(
          (item) =>
            item.result ===
              'REVIEW_PRICE' ||
            item.result ===
              'REVIEW_CLASS_AND_PRICE',
        )
        .map(
          (item) => ({
            Actividad:
              item.activity,

            Profesor:
              item.teacher,

            Clase:
              item.className,

            'Vigencia desde':
              item.validFrom,

            'Vigencia hasta':
              item.validTo,

            Importe:
              item.amount,

            Confianza:
              item.sourceConfidence,

            Revisión:
              item.sourceReview,

            'Filas origen':
              item.sourceRows,
          }),
        ),
    ),
    'Revisar precios',
  );

  utils.book_append_sheet(
    workbookOut,
    utils.json_to_sheet([
      {
        Métrica:
          'Total',

        Cantidad:
          analysis.length,
      },

      {
        Métrica:
          'OK',

        Cantidad:
          counts.OK ?? 0,
      },

      {
        Métrica:
          'Revisar precio',

        Cantidad:
          counts.REVIEW_PRICE ??
          0,
      },

      {
        Métrica:
          'Revisar clase',

        Cantidad:
          counts.REVIEW_CLASS ??
          0,
      },

      {
        Métrica:
          'Revisar clase y precio',

        Cantidad:
          counts.REVIEW_CLASS_AND_PRICE ??
          0,
      },
    ]),
    'Resumen',
  );

  writeFile(
    workbookOut,
    OUTPUT_XLSX,
  );

  console.log('');
  console.log(
    `📄 JSON: ${OUTPUT_JSON}`,
  );

  console.log(
    `📊 Excel: ${OUTPUT_XLSX}`,
  );

  console.log('');
  console.log(
    'ℹ️ Este script NO modifica la base de datos.',
  );
}

await main();