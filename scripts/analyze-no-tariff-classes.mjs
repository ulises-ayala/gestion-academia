import fs from 'node:fs/promises';
import path from 'node:path';

import xlsx from 'xlsx';

const {
  utils,
  read,
  writeFile,
} = xlsx;

/* =========================================================
 * CONFIG
 * ========================================================= */

const ENROLLMENTS_FILE = path.resolve(
  './exports/enrollments-current.json',
);

const TARIFF_ANALYSIS_FILE = path.resolve(
  './exports/historical-tariffs-analysis.json',
);

const TARIFF_READY_FILE = path.resolve(
  './exports/historical-tariffs-ready.json',
);

const HISTORICAL_EXCEL_CANDIDATES = [
  path.resolve(
    './scripts/data/Historial_Carmesi_2025_2026_NORMALIZADO.xlsx',
  ),

  path.resolve(
    './scripts/data/Historial_Carmesi_2025_2026_NORMALIZADO(1).xlsx',
  ),
];

const OUTPUT_DIR = path.resolve(
  './exports',
);

const OUTPUT_JSON = path.join(
  OUTPUT_DIR,
  'no-tariff-classes-analysis.json',
);

const OUTPUT_XLSX = path.join(
  OUTPUT_DIR,
  'no-tariff-classes-analysis.xlsx',
);

const HISTORICAL_CUTOFF =
  '2026-08-31';

const MAX_ALIAS_CANDIDATES = 10;

const MAX_WORKBOOK_MATCHES = 40;

const MIN_ALIAS_SCORE = 0.45;

const MIN_WORKBOOK_SCORE = 0.25;

const CONFIRMED_CLASS_MAPPINGS = {
  /*
   * La clave siempre está normalizada con normalizeText().
   *
   * targetType:
   *
   * SAME_ACTIVITY
   *   → Es la misma actividad, solo cambió el nombre.
   *
   * HISTORICAL_ACTIVITY
   *   → Corresponde a una actividad histórica determinada,
   *     pero queremos conservar la clase actual.
   *
   * SPECIAL_PROGRAM
   *   → Tiene esquema tarifario propio.
   *
   * TEST_CLASS
   *   → Clase de prueba que no debe participar de la
   *     reconstrucción histórica.
   */

  'S B PAREJAS': {
    targetType: 'SAME_ACTIVITY',

    historicalNames: [
      'Salsa y Bachata en Pareja',
      'Salsa Y Bachata En Pareja',
      'Salsa Y Bachata En Pareja _Fabi',
    ],

    reason:
      'PO confirmó que S&B Parejas corresponde a Salsa y Bachata en Pareja.',
  },

  'CLASE KIZOMBA': {
    targetType: 'HISTORICAL_ACTIVITY',

    historicalNames: [
      'Kizomba',
      'Clase Kizomba',
    ],

    teacherNames: [
      'FABI',
    ],

    tariffPolicy:
      'GENERAL_ACADEMY_RATE',

    reason:
      'PO confirmó que corresponde a la clase de Kizomba de Fabi y utilizaba la cuota base general de la academia.',
  },

  'HELLS': {
    targetType: 'SAME_ACTIVITY',

    historicalNames: [
      'Heels',
    ],

    reason:
      'PO confirmó que Hells es un error de escritura y corresponde a Heels.',
  },

  'FORMACION DOCENTE EN RITMOS CARIBENOS Y KIZOMBA': {
    targetType: 'SPECIAL_PROGRAM',

    historicalNames: [
      'Formacion Docente En Ritmos Caribeños Y Kizomba',
      'Formación Docente En Ritmos Caribeños Y Kizomba',
    ],

    validFrom:
      '2026-04-01',

    validTo:
      '2026-12-31',

    baseAmount:
      '90000.00',

    reason:
      'PO confirmó que la formación comenzó en abril de 2026, termina en diciembre de 2026 y tiene cuota base mensual de $90.000. Los valores $76.500, $72.000 y becas son condiciones particulares.',
  },

  'GRUPO C SOFI': {
    targetType: 'SAME_ACTIVITY',

    historicalNames: [
      'Coreográfico Femenino',
      'Coreografico Femenino',
      'Estilo Femenino',
    ],

    teacherNames: [
      'SOFIA',
      'SOFI',
    ],

    reason:
      'PO confirmó que Grupo C. Sofi corresponde al Coreográfico Femenino de Sofi.',
  },

  'COREOGRAFICO E MASC BACHATA URBAN': {
    targetType: 'HISTORICAL_ACTIVITY',

    historicalNames: [
      'Coreografico E Masc Bachata Urban',
      'Coreográfico E Masc Bachata Urban',
      'Coreografico E.Masc-Bachata/Urban',
    ],

    tariffPolicy:
      'GENERAL_ACADEMY_RATE',

    currentName:
      'Urban Flow',

    reason:
      'PO confirmó que era una actividad independiente, utilizaba la cuota general y posteriormente pasó a llamarse Urban Flow.',
  },

  'INST SUP COREOGRAFICO TANGO 18 MESES': {
    targetType: 'SPECIAL_PROGRAM',

    historicalNames: [
      'Inst Sup Coreografico Tango 18 Meses',
      'Inst.Sup.Coreografico -Tango /18 Meses',
      'Instituto Superior Coreografico Tango 18 Meses',
    ],

    baseAmount:
      '70000.00',

    currentlyActive:
      false,

    reason:
      'PO confirmó que era un programa diferente de Tango regular, con cuota mensual de $70.000 y actualmente está dado de baja.',
  },

  'ARABASHE': {
    targetType: 'TEST_CLASS',

    historicalNames: [],

    reason:
      'Clase de prueba. No corresponde reconstruir tarifas históricas y será eliminada posteriormente.',
  },
};

/* =========================================================
 * NORMALIZACIÓN
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

function getConfirmedMapping(
  className,
) {
  return (
    CONFIRMED_CLASS_MAPPINGS[
      normalizeText(
        className,
      )
    ] ??
    null
  );
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .filter(Boolean);
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

/* =========================================================
 * SIMILITUD
 * ========================================================= */

function jaccardSimilarity(
  left,
  right,
) {
  const leftTokens =
    new Set(
      tokenize(left),
    );

  const rightTokens =
    new Set(
      tokenize(right),
    );

  if (
    leftTokens.size === 0 ||
    rightTokens.size === 0
  ) {
    return 0;
  }

  let intersection = 0;

  for (
    const token
    of leftTokens
  ) {
    if (
      rightTokens.has(token)
    ) {
      intersection++;
    }
  }

  const union =
    new Set([
      ...leftTokens,
      ...rightTokens,
    ]).size;

  if (union === 0) {
    return 0;
  }

  return (
    intersection /
    union
  );
}

function containmentSimilarity(
  left,
  right,
) {
  const a =
    normalizeText(left);

  const b =
    normalizeText(right);

  if (!a || !b) {
    return 0;
  }

  if (
    a === b
  ) {
    return 1;
  }

  if (
    a.includes(b) ||
    b.includes(a)
  ) {
    const shorter =
      Math.min(
        a.length,
        b.length,
      );

    const longer =
      Math.max(
        a.length,
        b.length,
      );

    return Math.max(
      0.6,
      shorter / longer,
    );
  }

  return 0;
}

function similarity(
  left,
  right,
) {
  const normalizedLeft =
    normalizeText(left);

  const normalizedRight =
    normalizeText(right);

  if (
    !normalizedLeft ||
    !normalizedRight
  ) {
    return 0;
  }

  if (
    normalizedLeft ===
    normalizedRight
  ) {
    return 1;
  }

  return Math.max(
    jaccardSimilarity(
      left,
      right,
    ),

    containmentSimilarity(
      left,
      right,
    ),
  );
}

/* =========================================================
 * HELPERS
 * ========================================================= */

function studentName(enrollment) {
  if (
    enrollment.student?.firstName ||
    enrollment.student?.lastName
  ) {
    return [
      enrollment.student?.lastName,
      enrollment.student?.firstName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  if (
    enrollment.studentName
  ) {
    return String(
      enrollment.studentName,
    ).trim();
  }

  return '';
}

function enrollmentClassName(
  enrollment,
) {
  return (
    enrollment.academicClass?.name ??
    enrollment.class?.name ??
    enrollment.className ??
    ''
  );
}

function enrollmentClassId(
  enrollment,
) {
  return (
    enrollment.classId ??
    enrollment.academicClass?.id ??
    enrollment.class?.id ??
    null
  );
}

function groupCount(
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
        b.count - a.count ||
        String(a.key).localeCompare(
          String(b.key),
          'es',
        ),
    );
}

function unique(values) {
  return [
    ...new Set(
      values.filter(Boolean),
    ),
  ];
}

/* =========================================================
 * JSON
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

  if (
    Array.isArray(parsed)
  ) {
    return parsed;
  }

  if (
    Array.isArray(
      parsed.items,
    )
  ) {
    return parsed.items;
  }

  if (
    Array.isArray(
      parsed.enrollments,
    )
  ) {
    return parsed.enrollments;
  }

  throw new Error(
    'No pude encontrar el array de enrollments.',
  );
}

async function readTariffAnalysis() {
  const parsed =
    await readJson(
      TARIFF_ANALYSIS_FILE,
    );

  const items =
    Array.isArray(parsed)
      ? parsed
      : parsed.items;

  if (
    !Array.isArray(items)
  ) {
    throw new Error(
      'historical-tariffs-analysis.json no contiene items.',
    );
  }

  return items;
}

async function readReadyTariffs() {
  const parsed =
    await readJson(
      TARIFF_READY_FILE,
    );

  const tariffs =
    Array.isArray(parsed)
      ? parsed
      : parsed.tariffs;

  if (
    !Array.isArray(tariffs)
  ) {
    throw new Error(
      'historical-tariffs-ready.json no contiene tariffs.',
    );
  }

  return tariffs;
}

/* =========================================================
 * EXCEL
 * ========================================================= */

async function findHistoricalWorkbook() {
  for (
    const candidate
    of HISTORICAL_EXCEL_CANDIDATES
  ) {
    try {
      await fs.access(
        candidate,
      );

      return candidate;
    } catch {
      // seguir buscando
    }
  }

  throw new Error(
    [
      'No encontré Historial_Carmesi_2025_2026_NORMALIZADO.xlsx.',
      '',
      'Rutas buscadas:',
      ...HISTORICAL_EXCEL_CANDIDATES,
    ].join('\n'),
  );
}

async function readHistoricalWorkbook() {
  const file =
    await findHistoricalWorkbook();

  const buffer =
    await fs.readFile(
      file,
    );

  const workbook =
    read(
      buffer,
      {
        type:
          'buffer',

        cellDates:
          false,
      },
    );

  const sheets =
    [];

  for (
    const sheetName
    of workbook.SheetNames
  ) {
    const worksheet =
      workbook.Sheets[
        sheetName
      ];

    const rows =
      utils.sheet_to_json(
        worksheet,
        {
          defval:
            null,

          raw:
            false,
        },
      );

    sheets.push({
      sheetName,
      rows,
    });
  }

  return {
    file,
    workbook,
    sheets,
  };
}

/* =========================================================
 * READY INDEX
 * ========================================================= */

function indexReadyTariffsByClass(
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
 * ENROLLMENTS POR CLASE
 * ========================================================= */

function groupEnrollmentsByClass(
  enrollments,
) {
  const map =
    new Map();

  for (
    const enrollment
    of enrollments
  ) {
    const classId =
      enrollmentClassId(
        enrollment,
      );

    if (
      !classId
    ) {
      continue;
    }

    if (
      !map.has(
        classId,
      )
    ) {
      map.set(
        classId,
        [],
      );
    }

    map
      .get(
        classId,
      )
      .push(
        enrollment,
      );
  }

  return map;
}

/* =========================================================
 * CLASES SIN TARIFA
 * ========================================================= */

function findNoTariffClasses(
  enrollments,
  readyTariffs,
) {
  const readyByClass =
    indexReadyTariffsByClass(
      readyTariffs,
    );

  const enrollmentsByClass =
    groupEnrollmentsByClass(
      enrollments,
    );

  const result = [];

  for (
    const [
      classId,
      classEnrollments,
    ]
    of enrollmentsByClass
  ) {
    if (
      readyByClass.has(
        classId,
      )
    ) {
      continue;
    }

    /*
     * Solo consideramos enrollments que comienzan
     * dentro o antes del corte histórico.
     */
    const historicalEnrollments =
      classEnrollments.filter(
        (item) => {
          const start =
            normalizeDate(
              item.startDate,
            );

          return (
            start &&
            start <=
              HISTORICAL_CUTOFF
          );
        },
      );

    if (
      historicalEnrollments.length === 0
    ) {
      continue;
    }

    const className =
      enrollmentClassName(
        historicalEnrollments[0],
      );

    result.push({
      classId,
      className,
      enrollments:
        historicalEnrollments,
    });
  }

  return result.sort(
    (a, b) =>
      b.enrollments.length -
        a.enrollments.length ||
      a.className.localeCompare(
        b.className,
        'es',
      ),
  );
}

/* =========================================================
 * BUSCAR EN ANALYSIS
 * ========================================================= */

function findExactAnalysisMatches(
  target,
  analysisItems,
) {
  return analysisItems.filter(
    (item) =>
      (
        item.classId &&
        item.classId ===
          target.classId
      ) ||
      (
        normalizeText(
          item.className,
        ) ===
        normalizeText(
          target.className,
        )
      ),
  );
}

function findConfirmedMappingMatches(
  target,
  analysisItems,
) {
  const mapping =
    getConfirmedMapping(
      target.className,
    );

  if (!mapping) {
    return [];
  }

  if (
    mapping.targetType ===
    'TEST_CLASS'
  ) {
    return [];
  }

  const historicalNames =
    mapping.historicalNames ??
    [];

  const teacherNames =
    (
      mapping.teacherNames ??
      []
    ).map(
      normalizeText,
    );

  const matches = [];

  for (
    const item
    of analysisItems
  ) {
    const candidateNames = [
      item.activity,
      item.className,
    ]
      .filter(Boolean);

    const matchedHistoricalName =
      historicalNames.find(
        (historicalName) =>
          candidateNames.some(
            (candidateName) =>
              normalizeText(
                candidateName,
              ) ===
              normalizeText(
                historicalName,
              ),
          ),
      );

    if (
      !matchedHistoricalName
    ) {
      continue;
    }

    /*
     * Si el mapping especifica profesor,
     * exigimos que coincida cuando el registro
     * histórico sí tiene profesor.
     */
    if (
      teacherNames.length > 0 &&
      item.teacher &&
      !teacherNames.includes(
        normalizeText(
          item.teacher,
        ),
      )
    ) {
      continue;
    }

    matches.push({
      classId:
        item.classId ??
        null,

      className:
        item.className ??
        null,

      activity:
        item.activity ??
        null,

      teacher:
        item.teacher ??
        null,

      result:
        item.result ??
        null,

      amount:
        normalizeAmount(
          item.amount,
        ),

      validFrom:
        normalizeDate(
          item.validFrom,
        ),

      validTo:
        normalizeDate(
          item.validTo,
        ),

      matchedHistoricalName,

      mappingType:
        mapping.targetType,

      mappingReason:
        mapping.reason,
    });
  }

  return matches;
}

function findAnalysisAliasCandidates(
  target,
  analysisItems,
) {
  const candidates = [];

  for (
    const item
    of analysisItems
  ) {
    const names =
      unique([
        item.className,
        item.activity,
      ]);

    let bestScore = 0;
    let matchedValue = '';

    for (
      const candidateName
      of names
    ) {
      const score =
        similarity(
          target.className,
          candidateName,
        );

      if (
        score >
        bestScore
      ) {
        bestScore =
          score;

        matchedValue =
          candidateName;
      }
    }

    if (
      bestScore <
      MIN_ALIAS_SCORE
    ) {
      continue;
    }

    candidates.push({
      score:
        Number(
          bestScore.toFixed(3),
        ),

      matchedValue,

      classId:
        item.classId ??
        null,

      className:
        item.className ??
        null,

      activity:
        item.activity ??
        null,

      teacher:
        item.teacher ??
        null,

      result:
        item.result ??
        null,

      amount:
        normalizeAmount(
          item.amount,
        ),

      validFrom:
        normalizeDate(
          item.validFrom,
        ),

      validTo:
        normalizeDate(
          item.validTo,
        ),

      reason:
        item.priceDecisionReason ??
        item.reason ??
        null,
    });
  }

  const deduplicated =
    new Map();

  for (
    const candidate
    of candidates
  ) {
    const key = [
      candidate.classId,
      candidate.className,
      candidate.activity,
      candidate.teacher,
      candidate.result,
      candidate.amount,
      candidate.validFrom,
      candidate.validTo,
    ].join('|');

    const previous =
      deduplicated.get(
        key,
      );

    if (
      !previous ||
      candidate.score >
        previous.score
    ) {
      deduplicated.set(
        key,
        candidate,
      );
    }
  }

  return [
    ...deduplicated.values(),
  ]
    .sort(
      (a, b) =>
        b.score -
        a.score,
    )
    .slice(
      0,
      MAX_ALIAS_CANDIDATES,
    );
}

/* =========================================================
 * READY SIMILARES
 * ========================================================= */

function findReadyAliasCandidates(
  target,
  readyTariffs,
) {
  const classes =
    new Map();

  for (
    const tariff
    of readyTariffs
  ) {
    if (
      !tariff.classId ||
      !tariff.className
    ) {
      continue;
    }

    if (
      tariff.classId ===
      target.classId
    ) {
      continue;
    }

    if (
      !classes.has(
        tariff.classId,
      )
    ) {
      classes.set(
        tariff.classId,
        {
          classId:
            tariff.classId,

          className:
            tariff.className,

          tariffs:
            [],
        },
      );
    }

    classes
      .get(
        tariff.classId,
      )
      .tariffs
      .push(
        tariff,
      );
  }

  return [
    ...classes.values(),
  ]
    .map(
      (item) => ({
        ...item,

        score:
          Number(
            similarity(
              target.className,
              item.className,
            )
              .toFixed(3),
          ),
      }),
    )
    .filter(
      (item) =>
        item.score >=
        MIN_ALIAS_SCORE,
    )
    .sort(
      (a, b) =>
        b.score -
        a.score,
    )
    .slice(
      0,
      MAX_ALIAS_CANDIDATES,
    )
    .map(
      (item) => ({
        classId:
          item.classId,

        className:
          item.className,

        score:
          item.score,

        tariffCount:
          item.tariffs.length,

        tariffs:
          item.tariffs.map(
            (tariff) => ({
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
          ),
      }),
    );
}

/* =========================================================
 * BUSCAR EN EXCEL
 * ========================================================= */

function stringifyRow(row) {
  return Object.entries(
    row,
  )
    .filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        value !== '',
    )
    .map(
      ([key, value]) =>
        `${key}: ${value}`,
    )
    .join(' | ');
}

function findWorkbookMatches(
  target,
  sheets,
) {
  const matches = [];

  for (
    const sheet
    of sheets
  ) {
    for (
      let index = 0;
      index <
      sheet.rows.length;
      index++
    ) {
      const row =
        sheet.rows[index];

      let bestScore = 0;
      let bestColumn = null;
      let bestValue = null;

      for (
        const [
          column,
          rawValue,
        ]
        of Object.entries(
          row,
        )
      ) {
        if (
          rawValue === null ||
          rawValue === undefined
        ) {
          continue;
        }

        const value =
          String(
            rawValue,
          );

        const score =
          similarity(
            target.className,
            value,
          );

        if (
          score >
          bestScore
        ) {
          bestScore =
            score;

          bestColumn =
            column;

          bestValue =
            value;
        }
      }

      if (
        bestScore <
        MIN_WORKBOOK_SCORE
      ) {
        continue;
      }

      matches.push({
        sheet:
          sheet.sheetName,

        excelRow:
          index + 2,

        score:
          Number(
            bestScore.toFixed(3),
          ),

        matchedColumn:
          bestColumn,

        matchedValue:
          bestValue,

        row:
          row,

        rowText:
          stringifyRow(
            row,
          ),
      });
    }
  }

  return matches
    .sort(
      (a, b) =>
        b.score -
          a.score ||
        a.sheet.localeCompare(
          b.sheet,
          'es',
        ) ||
        a.excelRow -
          b.excelRow,
    )
    .slice(
      0,
      MAX_WORKBOOK_MATCHES,
    );
}

/* =========================================================
 * RESUMEN DE ENROLLMENTS
 * ========================================================= */

function buildEnrollmentSummary(
  target,
) {
  const enrollments =
    target.enrollments;

  const starts =
    enrollments
      .map(
        (item) =>
          normalizeDate(
            item.startDate,
          ),
      )
      .filter(Boolean)
      .sort();

  const ends =
    enrollments
      .map(
        (item) =>
          normalizeDate(
            item.endDate,
          ),
      )
      .filter(Boolean)
      .sort();

  return {
    enrollmentCount:
      enrollments.length,

    studentCount:
      new Set(
        enrollments.map(
          (item) =>
            item.studentId,
        ),
      ).size,

    firstStartDate:
      starts[0] ??
      null,

    lastStartDate:
      starts[
        starts.length - 1
      ] ?? null,

    firstEndDate:
      ends[0] ??
      null,

    lastEndDate:
      ends[
        ends.length - 1
      ] ?? null,

    statusCounts:
      groupCount(
        enrollments,
        (item) =>
          item.status,
      ),

    students:
      enrollments.map(
        (item) => ({
          enrollmentId:
            item.id,

          studentId:
            item.studentId,

          studentName:
            studentName(
              item,
            ),

          status:
            item.status,

          startDate:
            normalizeDate(
              item.startDate,
            ),

          endDate:
            normalizeDate(
              item.endDate,
            ),
        }),
      ),
  };
}

/* =========================================================
 * DIAGNÓSTICO
 * ========================================================= */

function classifyEvidence({
  target,
  confirmedMapping,
  confirmedMappingMatches,
  exactAnalysisMatches,
  analysisAliases,
  readyAliases,
  workbookMatches,
}) {
  /*
   * 1. Clase de prueba.
   */
  if (
    confirmedMapping?.targetType ===
    'TEST_CLASS'
  ) {
    return {
      diagnosis:
        'TEST_CLASS',

      reason:
        confirmedMapping.reason,
    };
  }

  /*
   * 2. Mapping confirmado:
   * misma actividad con otro nombre.
   */
  if (
    confirmedMapping?.targetType ===
    'SAME_ACTIVITY'
  ) {
    return {
      diagnosis:
        'CONFIRMED_MAPPING',

      reason:
        confirmedMapping.reason,
    };
  }

  /*
   * 3. Actividad histórica confirmada,
   * pero necesita reconstrucción tarifaria.
   */
  if (
    confirmedMapping?.targetType ===
    'HISTORICAL_ACTIVITY'
  ) {
    return {
      diagnosis:
        'CONFIRMED_HISTORICAL_ACTIVITY',

      reason:
        confirmedMapping.reason,
    };
  }

  /*
   * 4. Programa especial con esquema propio.
   */
  if (
    confirmedMapping?.targetType ===
    'SPECIAL_PROGRAM'
  ) {
    return {
      diagnosis:
        'CONFIRMED_SPECIAL_PROGRAM',

      reason:
        confirmedMapping.reason,
    };
  }

  /*
   * A partir de acá queda la heurística anterior
   * solamente para clases sin decisión del PO.
   */

  const exactResults =
    new Set(
      exactAnalysisMatches.map(
        (item) =>
          item.result,
      ),
    );

  if (
    exactAnalysisMatches.length >
    0
  ) {
    if (
      exactResults.has(
        'NOT_A_TARIFF',
      )
    ) {
      return {
        diagnosis:
          'SOURCE_SPECIAL_OR_NOT_TARIFF',

        reason:
          'La clase aparece directamente en el análisis histórico, pero al menos un registro fue clasificado como NOT_A_TARIFF.',
      };
    }

    return {
      diagnosis:
        'SOURCE_FOUND_NO_FINAL_TARIFF',

      reason:
        'La clase aparece directamente en historical-tariffs-analysis.json pero no terminó con tarifas en el dataset final.',
    };
  }

  const strongAnalysisAlias =
    analysisAliases.find(
      (item) =>
        item.score >=
        0.6,
    );

  const strongReadyAlias =
    readyAliases.find(
      (item) =>
        item.score >=
        0.6,
    );

  if (
    strongAnalysisAlias ||
    strongReadyAlias
  ) {
    return {
      diagnosis:
        'POSSIBLE_ALIAS',

      reason:
        'Hay otra actividad o clase con un nombre suficientemente similar como para revisar un posible mapping histórico.',
    };
  }

  if (
    workbookMatches.length >
    0
  ) {
    return {
      diagnosis:
        'WORKBOOK_EVIDENCE_ONLY',

      reason:
        'Hay coincidencias en el Excel histórico, pero no existe una asociación directa con una tarifa final.',
    };
  }

  return {
    diagnosis:
      'NO_SOURCE_EVIDENCE',

    reason:
      'No se encontró evidencia directa suficiente en las fuentes analizadas.',
  };
}

/* =========================================================
 * ANALIZAR CLASE
 * ========================================================= */

function analyzeTargetClass({
  target,
  analysisItems,
  readyTariffs,
  workbookSheets,
}) {
  const enrollmentSummary =
    buildEnrollmentSummary(
      target,
    );

  const confirmedMapping =
  getConfirmedMapping(
    target.className,
  );

const confirmedMappingMatches =
  findConfirmedMappingMatches(
    target,
    analysisItems,
  );

  const exactAnalysisMatches =
    findExactAnalysisMatches(
      target,
      analysisItems,
    );

  const analysisAliases =
    findAnalysisAliasCandidates(
      target,
      analysisItems,
    );

  const readyAliases =
    findReadyAliasCandidates(
      target,
      readyTariffs,
    );

  const workbookMatches =
    findWorkbookMatches(
      target,
      workbookSheets,
    );

  const classification =
    classifyEvidence({
      target,
      confirmedMapping,
      confirmedMappingMatches,
      exactAnalysisMatches,
      analysisAliases,
      readyAliases,
      workbookMatches,
    });

  return {
    classId:
      target.classId,

    className:
      target.className,

    ...enrollmentSummary,

    diagnosis:
      classification.diagnosis,

    diagnosisReason:
      classification.reason,

    exactAnalysisMatches:
      exactAnalysisMatches.map(
        (item) => ({
          classId:
            item.classId ??
            null,

          className:
            item.className ??
            null,

          activity:
            item.activity ??
            null,

          teacher:
            item.teacher ??
            null,

          result:
            item.result ??
            null,

          amount:
            normalizeAmount(
              item.amount,
            ),

          validFrom:
            normalizeDate(
              item.validFrom,
            ),

          validTo:
            normalizeDate(
              item.validTo,
            ),

          priceDecisionReason:
            item.priceDecisionReason ??
            null,
        }),
      ),

    analysisAliasCandidates:
      analysisAliases,

    readyAliasCandidates:
      readyAliases,

    workbookMatches,
    confirmedMapping:
      confirmedMapping
        ? {
            ...confirmedMapping,
          }
        : null,

    confirmedMappingMatches,
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
    ' ANÁLISIS DE CLASES SIN TARIFA',
  );

  console.log(
    '=========================================================',
  );

  console.log('');

  console.log(
    `📄 Enrollments: ${ENROLLMENTS_FILE}`,
  );

  console.log(
    `📄 Tariff analysis: ${TARIFF_ANALYSIS_FILE}`,
  );

  console.log(
    `📄 Tariffs ready: ${TARIFF_READY_FILE}`,
  );

  console.log(
    `📅 Corte histórico: ${HISTORICAL_CUTOFF}`,
  );

  /* =======================================================
   * CARGA
   * ======================================================= */

  const enrollments =
    await readEnrollments();

  const analysisItems =
    await readTariffAnalysis();

  const readyTariffs =
    await readReadyTariffs();

  const historicalWorkbook =
    await readHistoricalWorkbook();

  console.log('');
  console.log(
    `🎓 Enrollments: ${enrollments.length}`,
  );

  console.log(
    `🔎 Registros tariff analysis: ${analysisItems.length}`,
  );

  console.log(
    `💰 Tarifas ready: ${readyTariffs.length}`,
  );

  console.log(
    `📊 Excel histórico: ${historicalWorkbook.file}`,
  );

  console.log(
    `📑 Hojas Excel: ${historicalWorkbook.sheets.length}`,
  );

  /* =======================================================
   * TARGETS
   * ======================================================= */

  const noTariffClasses =
    findNoTariffClasses(
      enrollments,
      readyTariffs,
    );

  console.log('');
  console.log(
    `⚠️ Clases con enrollments históricos pero sin tarifa: ${noTariffClasses.length}`,
  );

  for (
    const target
    of noTariffClasses
  ) {
    console.log(
      `- ${target.className}: ${target.enrollments.length} inscripciones`,
    );
  }

  /* =======================================================
   * ANÁLISIS
   * ======================================================= */

  const analyses = [];

  for (
    const target
    of noTariffClasses
  ) {
    console.log('');
    console.log(
      `🔍 Analizando ${target.className}...`,
    );

    analyses.push(
      analyzeTargetClass({
        target,
        analysisItems,
        readyTariffs,
        workbookSheets:
          historicalWorkbook.sheets,
      }),
    );
  }

const actionableAnalyses =
  analyses.filter(
    (item) =>
      item.diagnosis !==
      'TEST_CLASS',
  );

const testClassAnalyses =
  analyses.filter(
    (item) =>
      item.diagnosis ===
      'TEST_CLASS',
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

  const diagnosisSummary =
    groupCount(
      analyses,
      (item) =>
        item.diagnosis,
    );

  console.log(
    `⚠️ Clases reales pendientes: ${actionableAnalyses.length}`,
  );

  console.log(
    `🧪 Clases de prueba ignoradas: ${testClassAnalyses.length}`,
  );

  console.log('');
  console.log(
    '--- DIAGNÓSTICO ---',
  );

  for (
    const item
    of diagnosisSummary
  ) {
    console.log(
      `${item.key}: ${item.count}`,
    );
  }

  for (
    const item
    of analyses
  ) {
    console.log('');
    console.log(
      `--- ${item.className} ---`,
    );

    console.log(
      `Enrollments: ${item.enrollmentCount}`,
    );

    console.log(
      `Alumnos: ${item.studentCount}`,
    );

    console.log(
      `Primera inscripción: ${item.firstStartDate ?? '-'}`,
    );

    console.log(
      `Última inscripción: ${item.lastStartDate ?? '-'}`,
    );

    console.log(
      `Diagnóstico: ${item.diagnosis}`,
    );
    if (
      item.confirmedMapping
    ) {
      console.log(
        `Mapping confirmado: ${item.confirmedMapping.targetType}`,
      );

      if (
        item.confirmedMapping.historicalNames?.length >
        0
      ) {
        console.log(
          `Actividad/es histórica/s: ${item.confirmedMapping.historicalNames.join(' | ')}`,
        );
      }

      if (
        item.confirmedMapping.tariffPolicy
      ) {
        console.log(
          `Política tarifaria: ${item.confirmedMapping.tariffPolicy}`,
        );
      }

      if (
        item.confirmedMapping.baseAmount
      ) {
        console.log(
          `Tarifa base confirmada: $${item.confirmedMapping.baseAmount}`,
        );
      }

      console.log(
        `Matches confirmados encontrados: ${item.confirmedMappingMatches.length}`,
      );
    }

    console.log(
      `Coincidencias exactas analysis: ${item.exactAnalysisMatches.length}`,
    );

    console.log(
      `Alias analysis: ${item.analysisAliasCandidates.length}`,
    );

    console.log(
      `Alias ready: ${item.readyAliasCandidates.length}`,
    );

    console.log(
      `Coincidencias Excel: ${item.workbookMatches.length}`,
    );

    if (
      item.analysisAliasCandidates.length >
      0
    ) {
      console.log(
        'Mejores candidatos:',
      );

      for (
        const candidate
        of item.analysisAliasCandidates.slice(
          0,
          5,
        )
      ) {
        console.log(
          `  ${candidate.score} | ` +
          `${candidate.activity ?? candidate.className ?? '-'} | ` +
          `${candidate.teacher ?? '-'} | ` +
          `${candidate.result ?? '-'}`,
        );
      }
    }
  }

  /* =======================================================
   * JSON
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

    historicalCutoff:
      HISTORICAL_CUTOFF,

    source: {
      enrollments:
        ENROLLMENTS_FILE,

      tariffAnalysis:
        TARIFF_ANALYSIS_FILE,

      tariffReady:
        TARIFF_READY_FILE,

      historicalExcel:
        historicalWorkbook.file,
    },

    summary: {
      enrollmentCount:
        enrollments.length,

      tariffAnalysisItems:
        analysisItems.length,

      readyTariffCount:
        readyTariffs.length,

      noTariffClassCount:
        analyses.length,

      noTariffEnrollmentCount:
        analyses.reduce(
          (sum, item) =>
            sum +
            item.enrollmentCount,
          0,
        ),

      noTariffStudentCount:
        new Set(
          analyses.flatMap(
            (item) =>
              item.students.map(
                (student) =>
                  student.studentId,
              ),
          ),
        ).size,

      diagnosis:
        diagnosisSummary,
        actionableClassCount:
          actionableAnalyses.length,

        testClassCount:
          testClassAnalyses.length,
    },

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

  /* =======================================================
   * XLSX
   * ======================================================= */

  const workbook =
    utils.book_new();

  /* -------------------------------------------------------
   * Resumen
   * ------------------------------------------------------- */

  const summaryRows =
    analyses.map(
      (item) => ({
        Clase:
          item.className,

        'Class ID':
          item.classId,

        Enrollments:
          item.enrollmentCount,

        Alumnos:
          item.studentCount,

        'Primera inscripción':
          item.firstStartDate,

        'Última inscripción':
          item.lastStartDate,

        Diagnóstico:
          item.diagnosis,

        Motivo:
          item.diagnosisReason,

        'Matches exactos analysis':
          item.exactAnalysisMatches.length,

        'Alias analysis':
          item.analysisAliasCandidates.length,

        'Alias ready':
          item.readyAliasCandidates.length,

        'Matches Excel':
          item.workbookMatches.length,

        'Mapping confirmado':
          item.confirmedMapping?.targetType ??
          '',

        'Nombre/s histórico/s confirmado/s':
          item.confirmedMapping?.historicalNames
            ?.join(' | ') ??
          '',

        'Política tarifaria':
          item.confirmedMapping?.tariffPolicy ??
          '',

        'Tarifa base confirmada':
          item.confirmedMapping?.baseAmount ??
          '',

        'Motivo mapping':
          item.confirmedMapping?.reason ??
          '',

        'Matches mapping':
          item.confirmedMappingMatches.length,
      }),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      summaryRows,
    ),
    'Resumen clases',
  );

  /* -------------------------------------------------------
   * Enrollments
   * ------------------------------------------------------- */

  const enrollmentRows =
    analyses.flatMap(
      (item) =>
        item.students.map(
          (student) => ({
            Clase:
              item.className,

            'Class ID':
              item.classId,

            Alumno:
              student.studentName,

            'Student ID':
              student.studentId,

            'Enrollment ID':
              student.enrollmentId,

            Estado:
              student.status,

            Inicio:
              student.startDate,

            Fin:
              student.endDate,
          }),
        ),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      enrollmentRows,
    ),
    'Enrollments',
  );

  /* -------------------------------------------------------
   * Matches exactos en tariff analysis
   * ------------------------------------------------------- */

  const exactRows =
    analyses.flatMap(
      (item) =>
        item.exactAnalysisMatches.map(
          (match) => ({
            'Clase objetivo':
              item.className,

            'Class ID objetivo':
              item.classId,

            'Clase analysis':
              match.className,

            Actividad:
              match.activity,

            Profesor:
              match.teacher,

            Resultado:
              match.result,

            Importe:
              match.amount,

            Desde:
              match.validFrom,

            Hasta:
              match.validTo,

            Motivo:
              match.priceDecisionReason,
          }),
        ),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      exactRows,
    ),
    'Matches exactos',
  );

  /* -------------------------------------------------------
   * Alias analysis
   * ------------------------------------------------------- */

  const aliasAnalysisRows =
    analyses.flatMap(
      (item) =>
        item.analysisAliasCandidates.map(
          (candidate) => ({
            'Clase objetivo':
              item.className,

            Score:
              candidate.score,

            'Valor coincidente':
              candidate.matchedValue,

            'Clase candidata':
              candidate.className,

            'Class ID candidato':
              candidate.classId,

            Actividad:
              candidate.activity,

            Profesor:
              candidate.teacher,

            Resultado:
              candidate.result,

            Importe:
              candidate.amount,

            Desde:
              candidate.validFrom,

            Hasta:
              candidate.validTo,

            Motivo:
              candidate.reason,
          }),
        ),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      aliasAnalysisRows,
    ),
    'Alias analysis',
  );

  /* -------------------------------------------------------
   * Alias ready
   * ------------------------------------------------------- */

  const aliasReadyRows =
    analyses.flatMap(
      (item) =>
        item.readyAliasCandidates.flatMap(
          (candidate) =>
            candidate.tariffs.map(
              (tariff) => ({
                'Clase objetivo':
                  item.className,

                Score:
                  candidate.score,

                'Clase candidata':
                  candidate.className,

                'Class ID candidato':
                  candidate.classId,

                Importe:
                  tariff.amount,

                Desde:
                  tariff.validFrom,

                Hasta:
                  tariff.validTo,
              }),
            ),
        ),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      aliasReadyRows,
    ),
    'Alias tarifas ready',
  );

  /* -------------------------------------------------------
   * Excel matches
   * ------------------------------------------------------- */

  const workbookMatchRows =
    analyses.flatMap(
      (item) =>
        item.workbookMatches.map(
          (match) => ({
            'Clase objetivo':
              item.className,

            Hoja:
              match.sheet,

            'Fila Excel':
              match.excelRow,

            Score:
              match.score,

            Columna:
              match.matchedColumn,

            'Valor coincidente':
              match.matchedValue,

            'Fila completa':
              match.rowText,
          }),
        ),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      workbookMatchRows,
    ),
    'Matches Excel',
  );

  /* -------------------------------------------------------
   * Diagnóstico
   * ------------------------------------------------------- */

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      diagnosisSummary.map(
        (item) => ({
          Diagnóstico:
            item.key,

          Clases:
            item.count,
        }),
      ),
    ),
    'Diagnóstico',
  );

  /* -------------------------------------------------------
   * Metadata
   * ------------------------------------------------------- */

  const metadataRows = [
    {
      Métrica:
        'Enrollments totales',

      Cantidad:
        enrollments.length,
    },

    {
      Métrica:
        'Registros tariff analysis',

      Cantidad:
        analysisItems.length,
    },

    {
      Métrica:
        'Tarifas ready',

      Cantidad:
        readyTariffs.length,
    },

    {
      Métrica:
        'Clases sin tarifa',

      Cantidad:
        analyses.length,
    },

    {
      Métrica:
        'Enrollments en clases sin tarifa',

      Cantidad:
        analyses.reduce(
          (sum, item) =>
            sum +
            item.enrollmentCount,
          0,
        ),
    },
  ];

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      metadataRows,
    ),
    'Metadata',
  );

  const confirmedMappingRows =
    analyses.flatMap(
      (item) => {
        if (
          !item.confirmedMapping
        ) {
          return [];
        }

        if (
          item.confirmedMappingMatches.length ===
          0
        ) {
          return [
            {
              'Clase actual':
                item.className,

              'Class ID':
                item.classId,

              'Tipo mapping':
                item.confirmedMapping.targetType,

              'Nombre histórico confirmado':
                item.confirmedMapping.historicalNames
                  ?.join(' | ') ??
                '',

              Profesor:
                item.confirmedMapping.teacherNames
                  ?.join(' | ') ??
                '',

              'Tarifa base':
                item.confirmedMapping.baseAmount ??
                '',

              'Política tarifaria':
                item.confirmedMapping.tariffPolicy ??
                '',

              'Actividad encontrada':
                '',

              'Resultado analysis':
                '',

              Importe:
                '',

              Desde:
                '',

              Hasta:
                '',

              Motivo:
                item.confirmedMapping.reason,
            },
          ];
        }

        return item.confirmedMappingMatches.map(
          (match) => ({
            'Clase actual':
              item.className,

            'Class ID':
              item.classId,

            'Tipo mapping':
              item.confirmedMapping.targetType,

            'Nombre histórico confirmado':
              match.matchedHistoricalName,

            Profesor:
              match.teacher,

            'Tarifa base':
              item.confirmedMapping.baseAmount ??
              '',

            'Política tarifaria':
              item.confirmedMapping.tariffPolicy ??
              '',

            'Actividad encontrada':
              match.activity,

            'Resultado analysis':
              match.result,

            Importe:
              match.amount,

            Desde:
              match.validFrom,

            Hasta:
              match.validTo,

            Motivo:
              item.confirmedMapping.reason,
          }),
        );
      },
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      confirmedMappingRows,
    ),
    'Mappings confirmados',
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
        ? error.stack ??
          error.message
        : error,
    );

    console.error('');

    process.exitCode =
      1;
  },
);