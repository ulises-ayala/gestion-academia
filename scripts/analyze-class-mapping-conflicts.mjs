import fs from 'node:fs/promises';
import path from 'node:path';

import xlsx from 'xlsx';

const {
  utils,
  writeFile,
} = xlsx;

/* =========================================================
 * CONFIG
 * ========================================================= */

const MIGRATION_PLAN_FILE = path.resolve(
  './exports/class-mapping-migration-plan.json',
);

const ENROLLMENTS_FILE = path.resolve(
  './exports/enrollments-current.json',
);

const OUTPUT_DIR = path.resolve(
  './exports',
);

const OUTPUT_JSON = path.join(
  OUTPUT_DIR,
  'class-mapping-conflicts-analysis.json',
);

const OUTPUT_XLSX = path.join(
  OUTPUT_DIR,
  'class-mapping-conflicts-analysis.xlsx',
);

const SOURCE_CLASS_NAME =
  'Grupo C. Sofi';

const TARGET_CLASS_NAME =
  'Clase femenino Sofi';

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

  return String(
    enrollment.studentName ??
    '',
  ).trim();
}

function daysBetween(
  left,
  right,
) {
  if (
    !left ||
    !right
  ) {
    return null;
  }

  const a =
    new Date(
      `${left}T00:00:00.000Z`,
    );

  const b =
    new Date(
      `${right}T00:00:00.000Z`,
    );

  if (
    Number.isNaN(
      a.getTime(),
    ) ||
    Number.isNaN(
      b.getTime(),
    )
  ) {
    return null;
  }

  return Math.round(
    (
      b.getTime() -
      a.getTime()
    ) /
    86_400_000,
  );
}

function dateRangesOverlap(
  leftStart,
  leftEnd,
  rightStart,
  rightEnd,
) {
  const aStart =
    leftStart ??
    '0000-01-01';

  const aEnd =
    leftEnd ??
    '9999-12-31';

  const bStart =
    rightStart ??
    '0000-01-01';

  const bEnd =
    rightEnd ??
    '9999-12-31';

  return (
    aStart <= bEnd &&
    bStart <= aEnd
  );
}

function formatRange(
  start,
  end,
) {
  return (
    `${start ?? '?'} → ` +
    `${end ?? 'null'}`
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

/* =========================================================
 * INDEXES
 * ========================================================= */

function indexEnrollmentsById(
  enrollments,
) {
  return new Map(
    enrollments.map(
      (item) => [
        item.id,
        item,
      ],
    ),
  );
}

function indexEnrollmentsByStudentClass(
  enrollments,
) {
  const map =
    new Map();

  for (
    const enrollment
    of enrollments
  ) {
    const key =
      `${enrollment.studentId}|${enrollment.classId}`;

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
        enrollment,
      );
  }

  return map;
}

/* =========================================================
 * ENCONTRAR LOS 5 CONFLICTOS
 * ========================================================= */

function findGrupoCSofiConflicts(
  migrationPlan,
) {
  const conflicts =
    migrationPlan.conflicts ??
    [];

  return conflicts.filter(
    (item) =>
      normalizeText(
        item.sourceClassName,
      ) ===
        normalizeText(
          SOURCE_CLASS_NAME,
        ) &&
      normalizeText(
        item.targetClassName,
      ) ===
        normalizeText(
          TARGET_CLASS_NAME,
        ),
  );
}

/* =========================================================
 * CLASIFICACIÓN
 * ========================================================= */

function classifyConflict({
  sourceEnrollment,
  targetEnrollment,
}) {
  const sourceStart =
    normalizeDate(
      sourceEnrollment.startDate,
    );

  const sourceEnd =
    normalizeDate(
      sourceEnrollment.endDate,
    );

  const targetStart =
    normalizeDate(
      targetEnrollment.startDate,
    );

  const targetEnd =
    normalizeDate(
      targetEnrollment.endDate,
    );

  const sameStart =
    sourceStart ===
    targetStart;

  const sameEnd =
    sourceEnd ===
    targetEnd;

  const sameStatus =
    sourceEnrollment.status ===
    targetEnrollment.status;

  const overlap =
    dateRangesOverlap(
      sourceStart,
      sourceEnd,
      targetStart,
      targetEnd,
    );

/*
 * Caso 1:
 * mismos períodos y mismo estado.
 * Es un duplicado prácticamente exacto.
 */
if (
  sameStart &&
  sameEnd &&
  sameStatus
) {
  return {
    classification:
      'EXACT_DUPLICATE',

    recommendedAction:
      'KEEP_TARGET_REMOVE_SOURCE',

    confidence:
      'HIGH',

    reason:
      'Los enrollments tienen exactamente el mismo rango de fechas y el mismo estado. El PO confirmó que ambas clases representan la misma actividad.',
  };
}

/*
 * Caso 2:
 * mismos períodos pero distinto estado.
 *
 * No debemos decidir automáticamente cuál estado
 * representa correctamente la situación actual/histórica.
 */
if (
  sameStart &&
  sameEnd &&
  !sameStatus
) {
  return {
    classification:
      'DUPLICATE_STATUS_CONFLICT',

    recommendedAction:
      'REVIEW_STATUS_BEFORE_MERGE',

    confidence:
      'HIGH',

    reason:
      'Los enrollments representan el mismo período y la misma actividad, pero tienen estados diferentes. Debe decidirse qué estado conservar antes de eliminar el duplicado.',
  };
}
  /*
   * Caso 3:
   * períodos superpuestos.
   */
  if (
    overlap
  ) {
    return {
      classification:
        'OVERLAPPING_PERIODS',

      recommendedAction:
        'MERGE_HISTORY_REVIEW',

      confidence:
        'MEDIUM',

      reason:
        'Los períodos se superponen. Como el PO confirmó que ambas clases son la misma actividad, probablemente representan historia duplicada o parcialmente duplicada.',
    };
  }

  /*
   * Caso 4:
   * períodos separados.
   */
  return {
    classification:
      'SEPARATE_PERIODS',

    recommendedAction:
      'KEEP_BOTH_PERIODS_ON_TARGET_CLASS',

    confidence:
      'MEDIUM',

    reason:
      'Los períodos no se superponen. Podrían representar dos etapas distintas de la misma actividad.',
  };
}

/* =========================================================
 * ANALIZAR UN CONFLICTO
 * ========================================================= */

function analyzeConflict({
  conflict,
  enrollmentsById,
  studentClassIndex,
}) {
  const sourceEnrollment =
    enrollmentsById.get(
      conflict.sourceEnrollmentId,
    );

  if (
    !sourceEnrollment
  ) {
    return {
      studentId:
        conflict.studentId,

      studentName:
        conflict.studentName,

      sourceEnrollmentId:
        conflict.sourceEnrollmentId,

      error:
        'SOURCE_ENROLLMENT_NOT_FOUND',
    };
  }

  const targetKey =
    `${sourceEnrollment.studentId}|${conflict.targetClassId}`;

  const targetEnrollments =
    studentClassIndex.get(
      targetKey,
    ) ?? [];

  if (
    targetEnrollments.length ===
    0
  ) {
    return {
      studentId:
        sourceEnrollment.studentId,

      studentName:
        studentName(
          sourceEnrollment,
        ),

      sourceEnrollmentId:
        sourceEnrollment.id,

      error:
        'TARGET_ENROLLMENT_NOT_FOUND',
    };
  }

  /*
   * Normalmente esperamos un solo enrollment destino,
   * pero dejamos soporte para múltiples.
   */
  const comparisons =
    targetEnrollments.map(
      (targetEnrollment) => {
        const classification =
          classifyConflict({
            sourceEnrollment,
            targetEnrollment,
          });

        const sourceStart =
          normalizeDate(
            sourceEnrollment.startDate,
          );

        const sourceEnd =
          normalizeDate(
            sourceEnrollment.endDate,
          );

        const targetStart =
          normalizeDate(
            targetEnrollment.startDate,
          );

        const targetEnd =
          normalizeDate(
            targetEnrollment.endDate,
          );

        return {
          targetEnrollmentId:
            targetEnrollment.id,

          targetStatus:
            targetEnrollment.status,

          targetStartDate:
            targetStart,

          targetEndDate:
            targetEnd,

          sameStart:
            sourceStart ===
            targetStart,

          sameEnd:
            sourceEnd ===
            targetEnd,

          sameStatus:
            sourceEnrollment.status ===
            targetEnrollment.status,

          overlap:
            dateRangesOverlap(
              sourceStart,
              sourceEnd,
              targetStart,
              targetEnd,
            ),

          startDifferenceDays:
            daysBetween(
              sourceStart,
              targetStart,
            ),

          classification:
            classification.classification,

          recommendedAction:
            classification.recommendedAction,

          confidence:
            classification.confidence,

          reason:
            classification.reason,
        };
      },
    );

  return {
    studentId:
      sourceEnrollment.studentId,

    studentName:
      studentName(
        sourceEnrollment,
      ),

    sourceClassId:
      conflict.sourceClassId,

    sourceClassName:
      conflict.sourceClassName,

    targetClassId:
      conflict.targetClassId,

    targetClassName:
      conflict.targetClassName,

    sourceEnrollment: {
      id:
        sourceEnrollment.id,

      status:
        sourceEnrollment.status,

      startDate:
        normalizeDate(
          sourceEnrollment.startDate,
        ),

      endDate:
        normalizeDate(
          sourceEnrollment.endDate,
        ),
    },

    targetEnrollmentCount:
      targetEnrollments.length,

    comparisons,
  };
}

/* =========================================================
 * RESUMEN
 * ========================================================= */

function flattenComparisons(
  analyses,
) {
  return analyses.flatMap(
    (item) => {
      if (
        !item.comparisons
      ) {
        return [];
      }

      return item.comparisons.map(
        (comparison) => ({
          studentId:
            item.studentId,

          studentName:
            item.studentName,

          sourceClassId:
            item.sourceClassId,

          sourceClassName:
            item.sourceClassName,

          targetClassId:
            item.targetClassId,

          targetClassName:
            item.targetClassName,

          sourceEnrollmentId:
            item.sourceEnrollment.id,

          sourceStatus:
            item.sourceEnrollment.status,

          sourceStartDate:
            item.sourceEnrollment.startDate,

          sourceEndDate:
            item.sourceEnrollment.endDate,

          targetEnrollmentId:
            comparison.targetEnrollmentId,

          targetStatus:
            comparison.targetStatus,

          targetStartDate:
            comparison.targetStartDate,

          targetEndDate:
            comparison.targetEndDate,

          sameStart:
            comparison.sameStart,

          sameEnd:
            comparison.sameEnd,

          sameStatus:
            comparison.sameStatus,

          overlap:
            comparison.overlap,

          startDifferenceDays:
            comparison.startDifferenceDays,

          classification:
            comparison.classification,

          recommendedAction:
            comparison.recommendedAction,

          confidence:
            comparison.confidence,

          reason:
            comparison.reason,
        }),
      );
    },
  );
}

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
        b.count - a.count ||
        String(a.key).localeCompare(
          String(b.key),
          'es',
        ),
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
    ' ANÁLISIS DE CONFLICTOS DE MAPPING - GRUPO C. SOFI',
  );

  console.log(
    '=========================================================',
  );

  console.log('');

  console.log(
    `📄 Plan mappings: ${MIGRATION_PLAN_FILE}`,
  );

  console.log(
    `📄 Enrollments: ${ENROLLMENTS_FILE}`,
  );

  const migrationPlan =
    await readJson(
      MIGRATION_PLAN_FILE,
    );

  const enrollments =
    await readEnrollments();

  console.log(
    `🎓 Enrollments cargados: ${enrollments.length}`,
  );

  const conflicts =
    findGrupoCSofiConflicts(
      migrationPlan,
    );

  console.log(
    `💥 Conflictos Grupo C. Sofi encontrados: ${conflicts.length}`,
  );

  if (
    conflicts.length === 0
  ) {
    throw new Error(
      'No se encontraron conflictos de Grupo C. Sofi en el plan de migración.',
    );
  }

  const enrollmentsById =
    indexEnrollmentsById(
      enrollments,
    );

  const studentClassIndex =
    indexEnrollmentsByStudentClass(
      enrollments,
    );

  const analyses =
    conflicts.map(
      (conflict) =>
        analyzeConflict({
          conflict,
          enrollmentsById,
          studentClassIndex,
        }),
    );

  const comparisonRows =
    flattenComparisons(
      analyses,
    );

  const classificationSummary =
    countBy(
      comparisonRows,
      (item) =>
        item.classification,
    );

  const actionSummary =
    countBy(
      comparisonRows,
      (item) =>
        item.recommendedAction,
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

  console.log('');
  console.log(
    `👥 Alumnos conflictivos: ${analyses.length}`,
  );

  console.log(
    `🔍 Comparaciones enrollment: ${comparisonRows.length}`,
  );

  console.log('');
  console.log(
    '--- CLASIFICACIÓN ---',
  );

  for (
    const item
    of classificationSummary
  ) {
    console.log(
      `${item.key}: ${item.count}`,
    );
  }

  console.log('');
  console.log(
    '--- ACCIÓN RECOMENDADA ---',
  );

  for (
    const item
    of actionSummary
  ) {
    console.log(
      `${item.key}: ${item.count}`,
    );
  }

  for (
    const analysis
    of analyses
  ) {
    console.log('');
    console.log(
      `--- ${analysis.studentName || analysis.studentId} ---`,
    );

    if (
      analysis.error
    ) {
      console.log(
        `ERROR: ${analysis.error}`,
      );

      continue;
    }

    console.log(
      `Alumno: ${analysis.studentName}`,
    );

    console.log(
      `Student ID: ${analysis.studentId}`,
    );

    console.log(
      `Origen: ${analysis.sourceClassName}`,
    );

    console.log(
      `  ${formatRange(
        analysis.sourceEnrollment.startDate,
        analysis.sourceEnrollment.endDate,
      )}`,
    );

    console.log(
      `  Estado: ${analysis.sourceEnrollment.status}`,
    );

    for (
      const comparison
      of analysis.comparisons
    ) {
      console.log('');
      console.log(
        `Destino: ${analysis.targetClassName}`,
      );

      console.log(
        `  Enrollment: ${comparison.targetEnrollmentId}`,
      );

      console.log(
        `  ${formatRange(
          comparison.targetStartDate,
          comparison.targetEndDate,
        )}`,
      );

      console.log(
        `  Estado: ${comparison.targetStatus}`,
      );

      console.log(
        `  Clasificación: ${comparison.classification}`,
      );

      console.log(
        `  Acción sugerida: ${comparison.recommendedAction}`,
      );

      console.log(
        `  Confianza: ${comparison.confidence}`,
      );

      console.log(
        `  Motivo: ${comparison.reason}`,
      );
    }
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

    sourceClass:
      SOURCE_CLASS_NAME,

    targetClass:
      TARGET_CLASS_NAME,

    summary: {
      conflictStudents:
        analyses.length,

      comparisonCount:
        comparisonRows.length,

      classifications:
        classificationSummary,

      recommendedActions:
        actionSummary,
    },

    analyses,

    comparisons:
      comparisonRows,
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

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      comparisonRows.map(
        (item) => ({
          Alumno:
            item.studentName,

          'Student ID':
            item.studentId,

          'Enrollment origen':
            item.sourceEnrollmentId,

          'Estado origen':
            item.sourceStatus,

          'Inicio origen':
            item.sourceStartDate,

          'Fin origen':
            item.sourceEndDate,

          'Enrollment destino':
            item.targetEnrollmentId,

          'Estado destino':
            item.targetStatus,

          'Inicio destino':
            item.targetStartDate,

          'Fin destino':
            item.targetEndDate,

          'Mismo inicio':
            item.sameStart
              ? 'SI'
              : 'NO',

          'Mismo fin':
            item.sameEnd
              ? 'SI'
              : 'NO',

          'Mismo estado':
            item.sameStatus
              ? 'SI'
              : 'NO',

          Solapamiento:
            item.overlap
              ? 'SI'
              : 'NO',

          'Diferencia inicio días':
            item.startDifferenceDays,

          Clasificación:
            item.classification,

          'Acción sugerida':
            item.recommendedAction,

          Confianza:
            item.confidence,

          Motivo:
            item.reason,
        }),
      ),
    ),
    'Comparaciones',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      classificationSummary.map(
        (item) => ({
          Clasificación:
            item.key,

          Cantidad:
            item.count,
        }),
      ),
    ),
    'Clasificaciones',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      actionSummary.map(
        (item) => ({
          Acción:
            item.key,

          Cantidad:
            item.count,
        }),
      ),
    ),
    'Acciones sugeridas',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet([
      {
        Métrica:
          'Alumnos conflictivos',

        Cantidad:
          analyses.length,
      },
      {
        Métrica:
          'Comparaciones',

        Cantidad:
          comparisonRows.length,
      },
    ]),
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

    process.exitCode =
      1;
  },
);