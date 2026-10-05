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

const ENROLLMENTS_FILE = path.resolve(
  './exports/enrollments-current.json',
);

const RESOLUTION_PLAN_FILE = path.resolve(
  './exports/no-tariff-resolution-plan.json',
);

const OUTPUT_DIR = path.resolve(
  './exports',
);

const OUTPUT_JSON = path.join(
  OUTPUT_DIR,
  'class-mapping-migration-plan.json',
);

const OUTPUT_XLSX = path.join(
  OUTPUT_DIR,
  'class-mapping-migration-plan.xlsx',
);

/*
 * Operaciones estructurales confirmadas.
 *
 * Este script SOLO genera el plan.
 * No hace PATCH/POST/DELETE.
 */
const CLASS_MAPPING_RULES = [
  {
    sourceName:
      'S&B Parejas',

    operation:
      'RENAME_CLASS',

    targetName:
      'Salsa y Bachata en Pareja',

    reason:
      'PO confirmó que S&B Parejas corresponde a Salsa y Bachata en Pareja.',
  },

  {
    sourceName:
      'Hells',

    operation:
      'RENAME_CLASS',

    targetName:
      'Heels',

    reason:
      'PO confirmó que Hells es un error de escritura y corresponde a Heels.',
  },

  {
    sourceName:
      'Grupo C. Sofi',

    operation:
      'MOVE_ENROLLMENTS',

    targetName:
      'Clase femenino Sofi',

    reason:
      'PO confirmó que Grupo C. Sofi corresponde al Coreográfico Femenino de Sofi.',
  },
];

const FORMATION_CLASS_NAME =
  'Formacion Docente En Ritmos Caribeños Y Kizomba';

const FORMATION_REAL_START =
  '2026-04-01';

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

  return (
    enrollment.studentName ??
    ''
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

async function getAllClasses(
  sessionCookie,
) {
  const result = [];

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

    result.push(
      ...items,
    );

    if (
      Array.isArray(response) ||
      items.length < pageSize
    ) {
      break;
    }

    page++;
  }

  return result;
}

/* =========================================================
 * INDEXES
 * ========================================================= */

function indexClassesByName(
  classes,
) {
  const map =
    new Map();

  for (
    const item
    of classes
  ) {
    const key =
      normalizeText(
        item.name,
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
      .push(item);
  }

  return map;
}

function findSingleClass(
  classIndex,
  name,
) {
  const matches =
    classIndex.get(
      normalizeText(
        name,
      ),
    ) ?? [];

  if (
    matches.length === 1
  ) {
    return {
      status:
        'FOUND',

      class:
        matches[0],
    };
  }

  if (
    matches.length === 0
  ) {
    return {
      status:
        'NOT_FOUND',

      class:
        null,
    };
  }

  return {
    status:
      'AMBIGUOUS',

    class:
      null,

    matches,
  };
}

function groupEnrollmentsByClass(
  enrollments,
) {
  const map =
    new Map();

  for (
    const enrollment
    of enrollments
  ) {
    if (
      !enrollment.classId
    ) {
      continue;
    }

    if (
      !map.has(
        enrollment.classId,
      )
    ) {
      map.set(
        enrollment.classId,
        [],
      );
    }

    map
      .get(
        enrollment.classId,
      )
      .push(
        enrollment,
      );
  }

  return map;
}

function indexEnrollmentByStudentClass(
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
      .push(enrollment);
  }

  return map;
}

/* =========================================================
 * PLAN DE RENOMBRES
 * ========================================================= */

function buildRenamePlan({
  rule,
  classIndex,
  enrollmentsByClass,
}) {
  const source =
    findSingleClass(
      classIndex,
      rule.sourceName,
    );

  if (
    source.status !==
    'FOUND'
  ) {
    return {
      operation:
        rule.operation,

      sourceName:
        rule.sourceName,

      targetName:
        rule.targetName,

      status:
        'BLOCKED',

      reason:
        `No se pudo resolver la clase origen: ${source.status}.`,
    };
  }

  const targetMatches =
    classIndex.get(
      normalizeText(
        rule.targetName,
      ),
    ) ?? [];

  const distinctTarget =
    targetMatches.find(
      (item) =>
        item.id !==
        source.class.id,
    );

  if (
    distinctTarget
  ) {
    return {
      operation:
        rule.operation,

      sourceName:
        rule.sourceName,

      sourceClassId:
        source.class.id,

      targetName:
        rule.targetName,

      conflictingClassId:
        distinctTarget.id,

      status:
        'BLOCKED_TARGET_ALREADY_EXISTS',

      enrollmentCount:
        (
          enrollmentsByClass.get(
            source.class.id,
          ) ?? []
        ).length,

      reason:
        `Ya existe otra AcademyClass llamada "${rule.targetName}". No conviene renombrar automáticamente.`,
    };
  }

  return {
    operation:
      'RENAME_CLASS',

    sourceName:
      source.class.name,

    sourceClassId:
      source.class.id,

    targetName:
      rule.targetName,

    enrollmentCount:
      (
        enrollmentsByClass.get(
          source.class.id,
        ) ?? []
      ).length,

    status:
      'READY',

    reason:
      rule.reason,
  };
}

/* =========================================================
 * PLAN DE MOVIMIENTO
 * ========================================================= */

function buildMovePlan({
  rule,
  classIndex,
  enrollmentsByClass,
  studentClassIndex,
}) {
  const source =
    findSingleClass(
      classIndex,
      rule.sourceName,
    );

  const target =
    findSingleClass(
      classIndex,
      rule.targetName,
    );

  if (
    source.status !==
    'FOUND'
  ) {
    return {
      summary: {
        operation:
          rule.operation,

        sourceName:
          rule.sourceName,

        targetName:
          rule.targetName,

        status:
          'BLOCKED',

        reason:
          `Clase origen: ${source.status}.`,
      },

      moves: [],

      conflicts: [],
    };
  }

  if (
    target.status !==
    'FOUND'
  ) {
    return {
      summary: {
        operation:
          rule.operation,

        sourceName:
          rule.sourceName,

        sourceClassId:
          source.class.id,

        targetName:
          rule.targetName,

        status:
          'BLOCKED',

        reason:
          `Clase destino: ${target.status}.`,
      },

      moves: [],

      conflicts: [],
    };
  }

  const sourceEnrollments =
    enrollmentsByClass.get(
      source.class.id,
    ) ?? [];

  const moves = [];
  const conflicts = [];

  for (
    const enrollment
    of sourceEnrollments
  ) {
    const targetKey =
      `${enrollment.studentId}|${target.class.id}`;

    const targetExisting =
      studentClassIndex.get(
        targetKey,
      ) ?? [];

    if (
      targetExisting.length > 0
    ) {
      conflicts.push({
        type:
          'TARGET_ENROLLMENT_ALREADY_EXISTS',

        sourceEnrollmentId:
          enrollment.id,

        studentId:
          enrollment.studentId,

        studentName:
          studentName(
            enrollment,
          ),

        sourceClassId:
          source.class.id,

        sourceClassName:
          source.class.name,

        targetClassId:
          target.class.id,

        targetClassName:
          target.class.name,

        sourceStartDate:
          normalizeDate(
            enrollment.startDate,
          ),

        sourceEndDate:
          normalizeDate(
            enrollment.endDate,
          ),

        existingTargetEnrollments:
          targetExisting.map(
            (item) => ({
              id:
                item.id,

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
      });

      continue;
    }

    moves.push({
      enrollmentId:
        enrollment.id,

      studentId:
        enrollment.studentId,

      studentName:
        studentName(
          enrollment,
        ),

      status:
        enrollment.status,

      startDate:
        normalizeDate(
          enrollment.startDate,
        ),

      endDate:
        normalizeDate(
          enrollment.endDate,
        ),

      sourceClassId:
        source.class.id,

      sourceClassName:
        source.class.name,

      targetClassId:
        target.class.id,

      targetClassName:
        target.class.name,

      operation:
        'CHANGE_ENROLLMENT_CLASS',
    });
  }

  return {
    summary: {
      operation:
        'MOVE_ENROLLMENTS',

      sourceName:
        source.class.name,

      sourceClassId:
        source.class.id,

      targetName:
        target.class.name,

      targetClassId:
        target.class.id,

      sourceEnrollmentCount:
        sourceEnrollments.length,

      safeMoveCount:
        moves.length,

      conflictCount:
        conflicts.length,

      status:
        conflicts.length === 0
          ? 'READY'
          : 'REVIEW_CONFLICTS',

      reason:
        rule.reason,
    },

    moves,
    conflicts,
  };
}

/* =========================================================
 * FORMACIÓN: AUDITORÍA DE FECHAS
 * ========================================================= */

function buildFormationDateAudit({
  classIndex,
  enrollmentsByClass,
}) {
  const result =
    findSingleClass(
      classIndex,
      FORMATION_CLASS_NAME,
    );

  if (
    result.status !==
    'FOUND'
  ) {
    return {
      classFound:
        false,

      items: [],
    };
  }

  const enrollments =
    enrollmentsByClass.get(
      result.class.id,
    ) ?? [];

  const suspicious =
    enrollments
      .filter(
        (item) => {
          const start =
            normalizeDate(
              item.startDate,
            );

          return (
            start &&
            start <
              FORMATION_REAL_START
          );
        },
      )
      .map(
        (item) => ({
          enrollmentId:
            item.id,

          studentId:
            item.studentId,

          studentName:
            studentName(
              item,
            ),

          currentStartDate:
            normalizeDate(
              item.startDate,
            ),

          confirmedEarliestStart:
            FORMATION_REAL_START,

          status:
            item.status,

          issue:
            'START_BEFORE_CONFIRMED_PROGRAM_START',
        }),
      );

  return {
    classFound:
      true,

    classId:
      result.class.id,

    className:
      result.class.name,

    enrollmentCount:
      enrollments.length,

    suspiciousCount:
      suspicious.length,

    items:
      suspicious,
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
    ' PLAN DE MIGRACIÓN DE MAPPINGS DE CLASES',
  );

  console.log(
    '=========================================================',
  );

  console.log('');

  const enrollments =
    await readEnrollments();

  /*
   * También verificamos que el plan previo exista.
   */
  await readJson(
    RESOLUTION_PLAN_FILE,
  );

  console.log(
    `🎓 Enrollments cargados: ${enrollments.length}`,
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

  const classes =
    await getAllClasses(
      sessionCookie,
    );

  console.log(
    `💃 Clases en BDD: ${classes.length}`,
  );

  const classIndex =
    indexClassesByName(
      classes,
    );

  const enrollmentsByClass =
    groupEnrollmentsByClass(
      enrollments,
    );

  const studentClassIndex =
    indexEnrollmentByStudentClass(
      enrollments,
    );

  const operations = [];
  const moveRows = [];
  const conflicts = [];

  for (
    const rule
    of CLASS_MAPPING_RULES
  ) {
    if (
      rule.operation ===
      'RENAME_CLASS'
    ) {
      operations.push(
        buildRenamePlan({
          rule,
          classIndex,
          enrollmentsByClass,
        }),
      );

      continue;
    }

    if (
      rule.operation ===
      'MOVE_ENROLLMENTS'
    ) {
      const result =
        buildMovePlan({
          rule,
          classIndex,
          enrollmentsByClass,
          studentClassIndex,
        });

      operations.push(
        result.summary,
      );

      moveRows.push(
        ...result.moves,
      );

      conflicts.push(
        ...result.conflicts,
      );
    }
  }

  const formationAudit =
    buildFormationDateAudit({
      classIndex,
      enrollmentsByClass,
    });

  const readyOperations =
    operations.filter(
      (item) =>
        item.status ===
        'READY',
    );

  const blockedOperations =
    operations.filter(
      (item) =>
        item.status !==
        'READY',
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
    `✅ Operaciones listas: ${readyOperations.length}`,
  );

  console.log(
    `⚠️ Operaciones bloqueadas/revisión: ${blockedOperations.length}`,
  );

  console.log(
    `🔁 Enrollments seguros para mover: ${moveRows.length}`,
  );

  console.log(
    `💥 Conflictos de enrollment: ${conflicts.length}`,
  );

  console.log(
    `📅 Fechas sospechosas Formación: ${formationAudit.suspiciousCount ?? 0}`,
  );

  for (
    const operation
    of operations
  ) {
    console.log('');
    console.log(
      `--- ${operation.sourceName} ---`,
    );

    console.log(
      `Operación: ${operation.operation}`,
    );

    console.log(
      `Estado: ${operation.status}`,
    );

    if (
      operation.sourceClassId
    ) {
      console.log(
        `Origen: ${operation.sourceClassId}`,
      );
    }

    if (
      operation.targetName
    ) {
      console.log(
        `Destino/nombre: ${operation.targetName}`,
      );
    }

    if (
      operation.targetClassId
    ) {
      console.log(
        `Target ID: ${operation.targetClassId}`,
      );
    }

    if (
      operation.safeMoveCount !==
      undefined
    ) {
      console.log(
        `Moves seguros: ${operation.safeMoveCount}`,
      );

      console.log(
        `Conflictos: ${operation.conflictCount}`,
      );
    }

    console.log(
      `Motivo: ${operation.reason}`,
    );
  }

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

    summary: {
      operationCount:
        operations.length,

      readyOperationCount:
        readyOperations.length,

      blockedOperationCount:
        blockedOperations.length,

      safeEnrollmentMoves:
        moveRows.length,

      enrollmentConflicts:
        conflicts.length,

      formationSuspiciousStartDates:
        formationAudit.suspiciousCount ??
        0,
    },

    operations,

    enrollmentMoves:
      moveRows,

    conflicts,

    formationDateAudit:
      formationAudit,
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

  const workbook =
    utils.book_new();

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      operations,
    ),
    'Operaciones',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      moveRows,
    ),
    'Enrollment moves',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      conflicts.map(
        (item) => ({
          Tipo:
            item.type,

          Alumno:
            item.studentName,

          'Student ID':
            item.studentId,

          'Enrollment origen':
            item.sourceEnrollmentId,

          'Clase origen':
            item.sourceClassName,

          'Clase destino':
            item.targetClassName,

          'Enrollments destino existentes':
            JSON.stringify(
              item.existingTargetEnrollments,
            ),
        }),
      ),
    ),
    'Conflictos',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      formationAudit.items ??
      [],
    ),
    'Formacion fechas',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet([
      {
        Métrica:
          'Operaciones',

        Cantidad:
          operations.length,
      },
      {
        Métrica:
          'Operaciones READY',

        Cantidad:
          readyOperations.length,
      },
      {
        Métrica:
          'Operaciones revisión',

        Cantidad:
          blockedOperations.length,
      },
      {
        Métrica:
          'Enrollment moves seguros',

        Cantidad:
          moveRows.length,
      },
      {
        Métrica:
          'Conflictos',

        Cantidad:
          conflicts.length,
      },
      {
        Métrica:
          'Formation startDate sospechosos',

        Cantidad:
          formationAudit.suspiciousCount ??
          0,
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
    '✅ Plan generado. No se modificó la BDD.',
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

    process.exitCode =
      1;
  },
);