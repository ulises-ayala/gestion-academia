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

const CONFLICT_ANALYSIS_FILE = path.resolve(
  './exports/class-mapping-conflicts-analysis.json',
);

const ENROLLMENTS_FILE = path.resolve(
  './exports/enrollments-current.json',
);

const OUTPUT_DIR = path.resolve(
  './exports',
);

const OUTPUT_JSON = path.join(
  OUTPUT_DIR,
  'grupo-c-status-conflicts-analysis.json',
);

const OUTPUT_XLSX = path.join(
  OUTPUT_DIR,
  'grupo-c-status-conflicts-analysis.xlsx',
);

/*
 * Buscamos evidencia financiera en estas ubicaciones.
 *
 * El script toma el primer archivo que exista.
 */
const PAYMENT_FILE_CANDIDATES = [
  path.resolve(
    './ReporteMovimientosCaja.xlsx',
  ),

  path.resolve(
    './scripts/data/ReporteMovimientosCaja.xlsx',
  ),

  path.resolve(
    './exports/conciliacion-pagos.xlsx',
  ),

  path.resolve(
    './scripts/data/conciliacion-pagos.xlsx',
  ),
];

/*
 * No vamos a interpretar pagos generales como prueba
 * de permanencia en la clase.
 *
 * Solo los movimientos que mencionen algo relacionado
 * directamente con la actividad se consideran evidencia
 * específica.
 */
const CLASS_KEYWORDS = [
  'GRUPO C',
  'SOFI',
  'SOFIA',
  'FEMENINO',
  'ESTILO FEMENINO',
  'COREOGRAFICO FEMENINO',
  'COREOGRÁFICO FEMENINO',
];

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

  /*
   * Si ya viene AAAA-MM-DD.
   */
  const direct =
    String(value)
      .match(
        /^(\d{4})-(\d{2})-(\d{2})/,
      );

  if (direct) {
    return `${direct[1]}-${direct[2]}-${direct[3]}`;
  }

  /*
   * dd/mm/aaaa
   */
  const latin =
    String(value)
      .match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      );

  if (latin) {
    const day =
      latin[1]
        .padStart(
          2,
          '0',
        );

    const month =
      latin[2]
        .padStart(
          2,
          '0',
        );

    return `${latin[3]}-${month}-${day}`;
  }

  /*
   * Excel serial date.
   */
  const numeric =
    Number(value);

  if (
    Number.isFinite(numeric) &&
    numeric > 20_000 &&
    numeric < 100_000
  ) {
    const parsed =
      xlsx.SSF.parse_date_code(
        numeric,
      );

    if (parsed) {
      return (
        `${String(parsed.y).padStart(4, '0')}-` +
        `${String(parsed.m).padStart(2, '0')}-` +
        `${String(parsed.d).padStart(2, '0')}`
      );
    }
  }

/*
 * Último fallback solamente para strings que
 * realmente tengan apariencia de fecha.
 */
if (
  typeof value === 'string'
) {
  const trimmed =
    value.trim();

  if (
    /^\d{4}-\d{1,2}-\d{1,2}/.test(
      trimmed,
    ) ||
    /^\d{1,2}\/\d{1,2}\/\d{4}/.test(
      trimmed,
    )
  ) {
    const parsed =
      new Date(
        trimmed,
      );

    if (
      !Number.isNaN(
        parsed.getTime(),
      )
    ) {
      const result =
        parsed
          .toISOString()
          .slice(
            0,
            10,
          );

      if (
        result >= '2020-01-01' &&
        result <= '2030-12-31'
      ) {
        return result;
      }
    }
  }
}

return null;
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
 * ARCHIVO DE PAGOS
 * ========================================================= */

async function findPaymentFile() {
  for (
    const candidate
    of PAYMENT_FILE_CANDIDATES
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

  return null;
}

async function readPaymentWorkbook() {
  const file =
    await findPaymentFile();

  if (!file) {
    return {
      file:
        null,

      sheets:
        [],
    };
  }

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
    sheets,
  };
}

/* =========================================================
 * DETECCIÓN DE COLUMNAS
 * ========================================================= */

function detectDateFromRow(row) {
  const preferredColumns = [
    'fecha',
    'date',
    'fecha movimiento',
    'fecha de movimiento',
    'fecha pago',
    'fecha de pago',
    'fecha hora',
    'fecha y hora',
    'createdat',
    'created at',
  ];

  for (
    const [
      column,
      value,
    ]
    of Object.entries(
      row,
    )
  ) {
    const normalizedColumn =
      normalizeText(
        column,
      );

    const isDateColumn =
      preferredColumns.some(
        (candidate) =>
          normalizedColumn ===
          normalizeText(
            candidate,
          ),
      );

    if (!isDateColumn) {
      continue;
    }

    const date =
      normalizeDate(
        value,
      );

    if (
      date &&
      date >= '2020-01-01' &&
      date <= '2030-12-31'
    ) {
      return {
        column,
        value,
        date,
      };
    }
  }

  /*
   * Importante:
   * NO buscamos fechas en columnas arbitrarias.
   *
   * Un número de movimiento, socio, comprobante,
   * monto, etc. podría ser interpretado erróneamente
   * como fecha.
   */
  return null;
}

function detectAmountFromRow(row) {
  const preferredColumns = [
    'importe',
    'monto',
    'amount',
    'total',
    'valor',
  ];

  for (
    const [
      column,
      value,
    ]
    of Object.entries(
      row,
    )
  ) {
    const normalizedColumn =
      normalizeText(
        column,
      );

    const preferred =
      preferredColumns.some(
        (candidate) =>
          normalizedColumn ===
          normalizeText(
            candidate,
          ),
      );

    if (!preferred) {
      continue;
    }

    const cleaned =
      String(value ?? '')
        .replace(/\$/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.-]/g, '');

    const number =
      Number(
        cleaned,
      );

    if (
      Number.isFinite(
        number,
      )
    ) {
      return {
        column,
        value,
        amount:
          number,
      };
    }
  }

  return null;
}

/* =========================================================
 * MATCH DE ALUMNOS EN MOVIMIENTOS
 * ========================================================= */

function getStudentTokens(
  name,
) {
  return normalizeText(
    name,
  )
    .split(' ')
    .filter(
      (token) =>
        token.length >= 3,
    );
}

function rowMatchesStudent(
  rowText,
  name,
) {
  const normalizedRow =
    normalizeText(
      rowText,
    );

  const normalizedName =
    normalizeText(
      name,
    );

  /*
   * Mejor escenario:
   * nombre completo presente.
   */
  if (
    normalizedRow.includes(
      normalizedName,
    )
  ) {
    return {
      matched:
        true,

      score:
        1,

      method:
        'FULL_NAME',
    };
  }

  const tokens =
    getStudentTokens(
      name,
    );

  if (
    tokens.length === 0
  ) {
    return {
      matched:
        false,

      score:
        0,

      method:
        null,
    };
  }

  const matches =
    tokens.filter(
      (token) =>
        normalizedRow.includes(
          token,
        ),
    );

  const score =
    matches.length /
    tokens.length;

  /*
   * Exigimos al menos 2 tokens y 66%.
   */
  if (
    matches.length >= 2 &&
    score >= 0.66
  ) {
    return {
      matched:
        true,

      score:
        Number(
          score.toFixed(3),
        ),

      method:
        'NAME_TOKENS',
    };
  }

  return {
    matched:
      false,

    score:
      Number(
        score.toFixed(3),
      ),

    method:
      null,
  };
}

function rowHasClassEvidence(
  rowText,
) {
  const normalized =
    normalizeText(
      rowText,
    );

  const matchedKeywords =
    CLASS_KEYWORDS.filter(
      (keyword) =>
        normalized.includes(
          normalizeText(
            keyword,
          ),
        ),
    );

  return {
    hasSpecificEvidence:
      matchedKeywords.length > 0,

    matchedKeywords,
  };
}

/* =========================================================
 * MOVIMIENTOS POR ALUMNO
 * ========================================================= */

function findStudentMovements(
  studentNameValue,
  paymentSheets,
) {
  const movements = [];

  for (
    const sheet
    of paymentSheets
  ) {
    for (
      let index = 0;
      index <
      sheet.rows.length;
      index++
    ) {
      const row =
        sheet.rows[index];

      const rowText =
        stringifyRow(
          row,
        );

      const match =
        rowMatchesStudent(
          rowText,
          studentNameValue,
        );

      if (
        !match.matched
      ) {
        continue;
      }

      const date =
        detectDateFromRow(
          row,
        );

      const amount =
        detectAmountFromRow(
          row,
        );

      const classEvidence =
        rowHasClassEvidence(
          rowText,
        );

      movements.push({
        sheet:
          sheet.sheetName,

        excelRow:
          index + 2,

        matchMethod:
          match.method,

        matchScore:
          match.score,

        date:
          date?.date ??
          null,

        dateColumn:
          date?.column ??
          null,

        amount:
          amount?.amount ??
          null,

        amountColumn:
          amount?.column ??
          null,

        classSpecific:
          classEvidence.hasSpecificEvidence,

        classKeywords:
          classEvidence.matchedKeywords,

        rowText,

        raw:
          row,
      });
    }
  }

  return movements.sort(
    (a, b) =>
      String(
        a.date ?? '',
      ).localeCompare(
        String(
          b.date ?? '',
      ),
    ),
  );
}

/* =========================================================
 * ENROLLMENTS DEL ALUMNO
 * ========================================================= */

function getStudentEnrollments(
  studentId,
  enrollments,
) {
  return enrollments
    .filter(
      (item) =>
        item.studentId ===
        studentId,
    )
    .map(
      (item) => ({
        id:
          item.id,

        classId:
          item.classId,

        className:
          enrollmentClassName(
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
    )
    .sort(
      (a, b) =>
        String(
          a.startDate ?? '',
        ).localeCompare(
          String(
            b.startDate ?? '',
        ),
      ),
    );
}

/* =========================================================
 * CLASIFICACIÓN
 * ========================================================= */

function classifyStatusConflict({
  source,
  target,
  movements,
}) {
  const classSpecificMovements =
    movements.filter(
      (item) =>
        item.classSpecific,
    );

  const classSpecificAfterStart =
    classSpecificMovements.filter(
      (item) =>
        item.date &&
        item.date >=
          source.startDate,
    );

  const genericMovementsAfterStart =
    movements.filter(
      (item) =>
        item.date &&
        item.date >=
          source.startDate,
    );

  /*
   * Caso fuerte:
   * existe evidencia explícita que menciona
   * Sofi/Femenino/Grupo C.
   *
   * Sigue sin permitir derivar una fecha de baja,
   * pero sí favorece ACTIVE.
   */
  if (
    source.status ===
      'ACTIVE' &&
    target.status ===
      'ENDED' &&
    classSpecificAfterStart.length >
      0
  ) {
    return {
      classification:
        'LIKELY_ACTIVE',

      recommendedStatus:
        'ACTIVE',

      confidence:
        'MEDIUM',

      reason:
        'El enrollment origen está ACTIVE y existen movimientos posteriores al inicio que mencionan explícitamente la actividad/Grupo C/Sofi. La evidencia financiera respalda continuidad, pero no permite derivar una fecha de baja exacta.',
    };
  }

  /*
   * Si el target tiene endDate real,
   * esa es evidencia estructural importante.
   *
   * No aplica actualmente a estos dos casos,
   * pero dejamos la regla preparada.
   */
  if (
    target.status ===
      'ENDED' &&
    target.endDate
  ) {
    const explicitAfterEnd =
      classSpecificMovements.filter(
        (item) =>
          item.date &&
          item.date >
            target.endDate,
      );

    if (
      explicitAfterEnd.length ===
      0
    ) {
      return {
        classification:
          'LIKELY_ENDED',

        recommendedStatus:
          'ENDED',

        confidence:
          'MEDIUM',

        reason:
          'El enrollment destino está ENDED con endDate explícito y no se encontró evidencia específica posterior de continuidad en la actividad.',
      };
    }
  }

  /*
   * Pagos generales NO alcanzan para decidir.
   */
  if (
    genericMovementsAfterStart.length >
      0
  ) {
    return {
      classification:
        'INSUFFICIENT_EVIDENCE',

      recommendedStatus:
        null,

      confidence:
        'LOW',

      reason:
        'Hay movimientos financieros posteriores al inicio, pero no identifican de forma suficiente que correspondan a Grupo C. Sofi/Coreográfico Femenino. No se puede decidir ACTIVE vs ENDED automáticamente.',
    };
  }

  return {
    classification:
      'INSUFFICIENT_EVIDENCE',

    recommendedStatus:
      null,

    confidence:
      'LOW',

    reason:
      'Existe un conflicto ACTIVE vs ENDED y no se encontró evidencia independiente suficiente para decidir qué estado representa correctamente la inscripción.',
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
    ' ANÁLISIS DE ESTADO - GRUPO C. SOFI',
  );

  console.log(
    '=========================================================',
  );

  console.log('');

  const conflictAnalysis =
    await readJson(
      CONFLICT_ANALYSIS_FILE,
    );

  const enrollments =
    await readEnrollments();

  const paymentWorkbook =
    await readPaymentWorkbook();

  console.log(
    `🎓 Enrollments: ${enrollments.length}`,
  );

  if (
    paymentWorkbook.file
  ) {
    console.log(
      `💰 Fuente financiera: ${paymentWorkbook.file}`,
    );

    console.log(
      `📑 Hojas financieras: ${paymentWorkbook.sheets.length}`,
    );
  } else {
    console.log(
      '⚠️ No se encontró archivo financiero. El análisis continuará sin movimientos.',
    );
  }

  /* =======================================================
   * SOLO STATUS CONFLICTS
   * ======================================================= */

  const comparisons =
    (
      conflictAnalysis.comparisons ??
      []
    ).filter(
      (item) =>
        item.classification ===
        'DUPLICATE_STATUS_CONFLICT',
    );

  console.log('');
  console.log(
    `💥 Conflictos ACTIVE vs ENDED: ${comparisons.length}`,
  );

  if (
    comparisons.length === 0
  ) {
    throw new Error(
      'No se encontraron DUPLICATE_STATUS_CONFLICT.',
    );
  }

  const analyses = [];

  for (
    const conflict
    of comparisons
  ) {
    const studentEnrollments =
      getStudentEnrollments(
        conflict.studentId,
        enrollments,
      );

    const movements =
      findStudentMovements(
        conflict.studentName,
        paymentWorkbook.sheets,
      );

    const source = {
      id:
        conflict.sourceEnrollmentId,

      status:
        conflict.sourceStatus,

      startDate:
        conflict.sourceStartDate,

      endDate:
        conflict.sourceEndDate,
    };

    const target = {
      id:
        conflict.targetEnrollmentId,

      status:
        conflict.targetStatus,

      startDate:
        conflict.targetStartDate,

      endDate:
        conflict.targetEndDate,
    };

    const classification =
      classifyStatusConflict({
        source,
        target,
        movements,
      });

    const classSpecificMovements =
      movements.filter(
        (item) =>
          item.classSpecific,
      );

    const datedMovements =
      movements.filter(
        (item) =>
          item.date,
      );

    analyses.push({
      studentId:
        conflict.studentId,

      studentName:
        conflict.studentName,

      sourceClass:
        conflict.sourceClassName,

      targetClass:
        conflict.targetClassName,

      sourceEnrollment:
        source,

      targetEnrollment:
        target,

      allStudentEnrollments:
        studentEnrollments,

      paymentEvidence: {
        movementCount:
          movements.length,

        datedMovementCount:
          datedMovements.length,

        classSpecificMovementCount:
          classSpecificMovements.length,

        firstMovementDate:
          datedMovements[0]
            ?.date ??
          null,

        lastMovementDate:
          datedMovements[
            datedMovements.length -
            1
          ]?.date ??
          null,

        firstClassSpecificMovementDate:
          classSpecificMovements
            .filter(
              (item) =>
                item.date,
            )[0]?.date ??
          null,

        lastClassSpecificMovementDate:
          classSpecificMovements
            .filter(
              (item) =>
                item.date,
            )
            .at(-1)
            ?.date ??
          null,

        movements,
      },

      classification:
        classification.classification,

      recommendedStatus:
        classification.recommendedStatus,

      confidence:
        classification.confidence,

      reason:
        classification.reason,
    });
  }

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

  const classificationCounts =
    new Map();

  for (
    const item
    of analyses
  ) {
    classificationCounts.set(
      item.classification,
      (
        classificationCounts.get(
          item.classification,
        ) ??
        0
      ) + 1,
    );
  }

  console.log('');
  console.log(
    '--- CLASIFICACIÓN ---',
  );

  for (
    const [
      key,
      count,
    ]
    of classificationCounts
  ) {
    console.log(
      `${key}: ${count}`,
    );
  }

  for (
    const item
    of analyses
  ) {
    console.log('');
    console.log(
      `--- ${item.studentName} ---`,
    );

    console.log(
      `Student ID: ${item.studentId}`,
    );

    console.log('');
    console.log(
      `Origen (${item.sourceClass}):`,
    );

    console.log(
      `  ${item.sourceEnrollment.status} | ${item.sourceEnrollment.startDate} → ${item.sourceEnrollment.endDate ?? 'null'}`,
    );

    console.log(
      `Destino (${item.targetClass}):`,
    );

    console.log(
      `  ${item.targetEnrollment.status} | ${item.targetEnrollment.startDate} → ${item.targetEnrollment.endDate ?? 'null'}`,
    );

    console.log('');
    console.log(
      `Enrollments totales del alumno: ${item.allStudentEnrollments.length}`,
    );

    for (
      const enrollment
      of item.allStudentEnrollments
    ) {
      console.log(
        `  - ${enrollment.className || enrollment.classId} | ${enrollment.status} | ${enrollment.startDate ?? '?'} → ${enrollment.endDate ?? 'null'}`,
      );
    }

    console.log('');
    console.log(
      `Movimientos encontrados: ${item.paymentEvidence.movementCount}`,
    );

    console.log(
      `Movimientos con fecha: ${item.paymentEvidence.datedMovementCount}`,
    );

    console.log(
      `Movimientos específicos Grupo C/Sofi/Femenino: ${item.paymentEvidence.classSpecificMovementCount}`,
    );

    console.log(
      `Primer movimiento: ${item.paymentEvidence.firstMovementDate ?? '-'}`,
    );

    console.log(
      `Último movimiento: ${item.paymentEvidence.lastMovementDate ?? '-'}`,
    );

    console.log(
      `Primer movimiento específico: ${item.paymentEvidence.firstClassSpecificMovementDate ?? '-'}`,
    );

    console.log(
      `Último movimiento específico: ${item.paymentEvidence.lastClassSpecificMovementDate ?? '-'}`,
    );

    console.log('');
    console.log(
      `Clasificación: ${item.classification}`,
    );

    console.log(
      `Estado recomendado: ${item.recommendedStatus ?? 'NO DECIDIR AUTOMÁTICAMENTE'}`,
    );

    console.log(
      `Confianza: ${item.confidence}`,
    );

    console.log(
      `Motivo: ${item.reason}`,
    );
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

    paymentSource:
      paymentWorkbook.file,

    warning:
      'Los movimientos de caja no identifican necesariamente el período de cuota ni la actividad. Se utilizan únicamente como evidencia auxiliar y no para inferir automáticamente una fecha de baja.',

    summary: {
      statusConflicts:
        analyses.length,

      classifications:
        [
          ...classificationCounts.entries(),
        ].map(
          ([classification, count]) => ({
            classification,
            count,
          }),
        ),
    },

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

  const summaryRows =
    analyses.map(
      (item) => ({
        Alumno:
          item.studentName,

        'Student ID':
          item.studentId,

        'Estado origen':
          item.sourceEnrollment.status,

        'Inicio origen':
          item.sourceEnrollment.startDate,

        'Fin origen':
          item.sourceEnrollment.endDate,

        'Estado destino':
          item.targetEnrollment.status,

        'Inicio destino':
          item.targetEnrollment.startDate,

        'Fin destino':
          item.targetEnrollment.endDate,

        'Movimientos encontrados':
          item.paymentEvidence.movementCount,

        'Movimientos específicos':
          item.paymentEvidence.classSpecificMovementCount,

        'Primer movimiento':
          item.paymentEvidence.firstMovementDate,

        'Último movimiento':
          item.paymentEvidence.lastMovementDate,

        'Último movimiento específico':
          item.paymentEvidence.lastClassSpecificMovementDate,

        Clasificación:
          item.classification,

        'Estado recomendado':
          item.recommendedStatus ??
          '',

        Confianza:
          item.confidence,

        Motivo:
          item.reason,
      }),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      summaryRows,
    ),
    'Resumen',
  );

  const enrollmentRows =
    analyses.flatMap(
      (item) =>
        item.allStudentEnrollments.map(
          (enrollment) => ({
            Alumno:
              item.studentName,

            'Student ID':
              item.studentId,

            Clase:
              enrollment.className,

            'Class ID':
              enrollment.classId,

            'Enrollment ID':
              enrollment.id,

            Estado:
              enrollment.status,

            Inicio:
              enrollment.startDate,

            Fin:
              enrollment.endDate,
          }),
        ),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      enrollmentRows,
    ),
    'Todos enrollments',
  );

  const movementRows =
    analyses.flatMap(
      (item) =>
        item.paymentEvidence.movements.map(
          (movement) => ({
            Alumno:
              item.studentName,

            'Student ID':
              item.studentId,

            Hoja:
              movement.sheet,

            'Fila Excel':
              movement.excelRow,

            Fecha:
              movement.date,

            Importe:
              movement.amount,

            'Match alumno':
              movement.matchMethod,

            'Score alumno':
              movement.matchScore,

            'Evidencia específica':
              movement.classSpecific
                ? 'SI'
                : 'NO',

            Keywords:
              movement.classKeywords.join(
                ' | ',
              ),

            'Fila completa':
              movement.rowText,
          }),
        ),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      movementRows,
    ),
    'Movimientos',
  );

  const specificMovementRows =
    movementRows.filter(
      (item) =>
        item['Evidencia específica'] ===
        'SI',
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      specificMovementRows,
    ),
    'Evidencia especifica',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet([
      {
        Métrica:
          'Conflictos analizados',

        Cantidad:
          analyses.length,
      },

      ...[
        ...classificationCounts.entries(),
      ].map(
        ([classification, count]) => ({
          Métrica:
            classification,

          Cantidad:
            count,
        }),
      ),
    ]),
    'Metricas',
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

    console.error('');

    process.exitCode =
      1;
  },
);