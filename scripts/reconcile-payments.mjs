import fs from 'node:fs/promises';
import path from 'node:path';
import xlsx from 'xlsx';

const {
  readFile,
  writeFile,
  utils,
} = xlsx;

const STUDENTS_FILE = path.resolve(
  './exports/students-current.json',
);
const ENROLLMENTS_FILE = path.resolve(
  './exports/enrollments-current.json',
);
const CASH_REPORT_FILE = path.resolve(
  './scripts/data/ReporteMovimientosCaja.xlsx',
);

const OUTPUT_DIR = path.resolve('exports');

const EXACT_THRESHOLD = 1;
const FUZZY_THRESHOLD = 0.88;

/* ---------------------------------------------------------
 * Normalización
 * --------------------------------------------------------- */

function normalizeText(value) {
  if (!value) return '';

  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[.,;:'"()[\]{}]/g, ' ')
    .replace(/[-_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value) {
  return normalizeText(value);
}

/*
 * Compara también ignorando el orden de las palabras.
 *
 * "OVIEDO MAGALI ABIGAIL"
 * "MAGALI ABIGAIL OVIEDO"
 *
 * terminan con una representación comparable.
 */
function sortedName(value) {
  return normalizeName(value)
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');
}

/* ---------------------------------------------------------
 * Distancia / similitud
 * --------------------------------------------------------- */

function levenshtein(a, b) {
  const matrix = Array.from(
    { length: b.length + 1 },
    () => Array(a.length + 1).fill(0),
  );

  for (let i = 0; i <= b.length; i++) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost =
        b[i - 1] === a[j - 1]
          ? 0
          : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[b.length][a.length];
}

function similarity(a, b) {
  if (!a || !b) return 0;

  if (a === b) return 1;

  const distance = levenshtein(a, b);
  const maxLength = Math.max(a.length, b.length);

  return maxLength === 0
    ? 1
    : 1 - distance / maxLength;
}

/* ---------------------------------------------------------
 * Lectura de estudiantes
 * --------------------------------------------------------- */

async function loadStudents() {
  const raw = await fs.readFile(
    STUDENTS_FILE,
    'utf8',
  );

  const students = JSON.parse(raw);

  return students.map((student) => ({
    ...student,

    normalizedName: normalizeName(
      student.fullName ??
        `${student.lastName ?? ''} ${student.firstName ?? ''}`,
    ),

    sortedNormalizedName: sortedName(
      student.fullName ??
        `${student.lastName ?? ''} ${student.firstName ?? ''}`,
    ),
  }));
};

async function loadEnrollments() {
  const raw = await fs.readFile(
    ENROLLMENTS_FILE,
    'utf8',
  );

  const enrollments =
    JSON.parse(raw);

  if (!Array.isArray(enrollments)) {
    throw new Error(
      'enrollments-current.json no contiene un array.',
    );
  }

  return enrollments;
}

/* ---------------------------------------------------------
 * Lectura del Excel ControlFit
 * --------------------------------------------------------- */

function loadCashMovements() {
  const workbook = readFile(
    CASH_REPORT_FILE,
    {
      cellDates: true,
    },
  );

  const sheet =
    workbook.Sheets['ReporteMovimientosCaja'];

  if (!sheet) {
    throw new Error(
      'No se encontró la hoja "ReporteMovimientosCaja".',
    );
  }

  /*
   * En el reporte real los encabezados están
   * en la fila 13.
   */
  const rows = utils.sheet_to_json(
    sheet,
    {
      range: 12,
      defval: null,
    },
  );

  return rows
    .filter(
      (row) =>
        row['Detalle'] &&
        row['Fecha/Hora'],
    )
    .map((row) => {
      const detail = String(
        row['Detalle'] ?? '',
      ).trim();

      const {
        memberName,
        operation,
      } = parseDetail(detail);

      return {
        movementNumber:
          row['#'] ?? null,

        user:
          row['Usuario'] ?? null,

        detail,

        memberName,

        normalizedMemberName:
          normalizeName(memberName),

        sortedMemberName:
          sortedName(memberName),

        operation,

        date:
          parseExcelDate(
            row['Fecha/Hora'],
          ),

        paymentMethod:
          row['Pago'] ?? null,

        amount:
          Number(row['Total'] ?? 0),
      };
    });
}

/* ---------------------------------------------------------
 * Parseo del campo Detalle
 * --------------------------------------------------------- */

function parseDetail(detail) {
  if (!detail.includes('|')) {
    return {
      memberName: null,
      operation: detail.trim(),
    };
  }

  const [namePart, ...operationParts] =
    detail.split('|');

  return {
    memberName:
      namePart.trim() || null,

    operation:
      operationParts
        .join('|')
        .trim(),
  };
}

function parseExcelDate(value) {
  if (value instanceof Date) {
    return value;
  }

  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

/* ---------------------------------------------------------
 * Matching
 * --------------------------------------------------------- */

function findStudentMatch(
  movement,
  students,
) {
  if (!movement.memberName) {
    return {
      type: 'NO_MEMBER',
      student: null,
      score: 0,
    };
  }

  /*
   * 1. Coincidencia exacta usando apellido/nombre
   */
  const exact = students.find(
    (student) =>
      student.normalizedName ===
      movement.normalizedMemberName,
  );

  if (exact) {
    return {
      type: 'EXACT',
      student: exact,
      score: 1,
    };
  }

  /*
   * 2. Coincidencia exacta ignorando orden
   */
  const reordered = students.find(
    (student) =>
      student.sortedNormalizedName ===
      movement.sortedMemberName,
  );

  if (reordered) {
    return {
      type: 'EXACT_REORDERED',
      student: reordered,
      score: 1,
    };
  }

  /*
   * 3. Fuzzy matching
   */
  let bestStudent = null;
  let bestScore = 0;

  for (const student of students) {
    const directScore =
      similarity(
        movement.normalizedMemberName,
        student.normalizedName,
      );

    const sortedScore =
      similarity(
        movement.sortedMemberName,
        student.sortedNormalizedName,
      );

    const score = Math.max(
      directScore,
      sortedScore,
    );

    if (score > bestScore) {
      bestScore = score;
      bestStudent = student;
    }
  }

  if (
    bestStudent &&
    bestScore >= FUZZY_THRESHOLD
  ) {
    return {
      type: 'FUZZY',
      student: bestStudent,
      score: bestScore,
    };
  }

  return {
    type: 'NO_MATCH',
    student: bestStudent,
    score: bestScore,
  };
}

/* ---------------------------------------------------------
 * Conciliación
 * --------------------------------------------------------- */

function reconcile(
  movements,
  students,
) {
  return movements.map((movement) => {
    const match = findStudentMatch(
      movement,
      students,
    );

    return {
      ...movement,

      matchType:
        match.type,

      matchScore:
        Number(
          match.score.toFixed(4),
        ),

      studentId:
        match.student?.id ??
        null,

      studentDni:
        match.student?.dni ??
        null,

      studentFullName:
        match.student?.fullName ??
        null,

      studentStatus:
        match.student?.status ??
        null,
    };
  });
}

/* ---------------------------------------------------------
 * Resumen por alumno
 * --------------------------------------------------------- */

function buildStudentSummary(
  students,
  reconciled,
) {
  const movementsByStudent =
    new Map();

  for (const movement of reconciled) {
    /*
     * Los fuzzy NO se consideran conciliados
     * automáticamente.
     */
    if (
      !movement.studentId ||
      ![
        'EXACT',
        'EXACT_REORDERED',
      ].includes(movement.matchType)
    ) {
      continue;
    }

    const current =
      movementsByStudent.get(
        movement.studentId,
      ) ?? [];

    current.push(movement);

    movementsByStudent.set(
      movement.studentId,
      current,
    );
  }

  return students.map((student) => {
    const movements =
      movementsByStudent.get(
        student.id,
      ) ?? [];

    const paymentMovements =
      movements.filter(
        (movement) =>
          movement.memberName,
      );

    const feePayments =
      movements.filter(
        (movement) =>
          normalizeText(
            movement.operation,
          ).includes(
            'PAGO DE CUOTA',
          ),
      );

    const sorted =
      [...movements].sort(
        (a, b) =>
          (b.date?.getTime() ?? 0) -
          (a.date?.getTime() ?? 0),
      );

    const lastMovement =
      sorted[0] ?? null;

    const lastFeePayment =
      [...feePayments]
        .sort(
          (a, b) =>
            (b.date?.getTime() ?? 0) -
            (a.date?.getTime() ?? 0),
        )[0] ?? null;

    const totalAmount =
      paymentMovements.reduce(
        (sum, movement) =>
          sum + movement.amount,
        0,
      );

    const totalFeeAmount =
      feePayments.reduce(
        (sum, movement) =>
          sum + movement.amount,
        0,
      );

    return {
      studentId:
        student.id,

      dni:
        student.dni,

      fullName:
        student.fullName,

      status:
        student.status,

      movementsCount:
        movements.length,

      feePaymentsCount:
        feePayments.length,

      totalAmount,

      totalFeeAmount,

      lastMovementDate:
        lastMovement?.date ??
        null,

      lastMovementType:
        lastMovement?.operation ??
        null,

      lastFeePaymentDate:
        lastFeePayment?.date ??
        null,

      hasHistory:
        movements.length > 0
          ? 'SI'
          : 'NO',
    };
  });
}

/* ---------------------------------------------------------
 * Excel
 * --------------------------------------------------------- */

function formatDate(date) {
  if (!date) return null;

  return date
    .toISOString()
    .slice(0, 10);
}

function movementForExcel(movement) {
  return {
    Numero:
      movement.movementNumber,

    Nombre_ControlFit:
      movement.memberName,

    Nombre_Carmesi:
      movement.studentFullName,

    DNI:
      movement.studentDni,

    Student_ID:
      movement.studentId,

    Estado_Alumno:
      movement.studentStatus,

    Tipo_Match:
      movement.matchType,

    Similitud:
      movement.matchScore,

    Fecha:
      formatDate(
        movement.date,
      ),

    Operacion:
      movement.operation,

    Medio_Pago:
      movement.paymentMethod,

    Importe:
      movement.amount,

    Usuario_ControlFit:
      movement.user,

    Detalle_Original:
      movement.detail,
  };
}
function getMonthKey(date) {
  if (!date) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function monthsBetween(
  olderDate,
  newerDate,
) {
  if (
    !olderDate ||
    !newerDate
  ) {
    return null;
  }

  return (
    (
      newerDate.getFullYear() -
      olderDate.getFullYear()
    ) *
      12 +
    (
      newerDate.getMonth() -
      olderDate.getMonth()
    )
  );
}

function buildPaymentsByMonth(students, reconciled) {
  /*
   * Solo movimientos conciliados con seguridad.
   */
  const exactMovements = reconciled.filter(
    (movement) =>
      movement.studentId &&
      ['EXACT', 'EXACT_REORDERED'].includes(
        movement.matchType,
      ),
  );

  /*
   * Solo "Pago de cuota".
   */
  const feePayments = exactMovements.filter(
    (movement) =>
      normalizeText(
        movement.operation,
      ).includes('PAGO DE CUOTA'),
  );

  /*
   * Determinamos qué meses existen realmente
   * en el reporte.
   */
  const months = [
    ...new Set(
      feePayments
        .map((movement) =>
          getMonthKey(movement.date),
        )
        .filter(Boolean),
    ),
  ].sort();

  /*
   * studentId -> Map(mes -> total)
   */
  const amountsByStudent = new Map();

  for (const movement of feePayments) {
    const month =
      getMonthKey(movement.date);

    if (!month) continue;

    if (
      !amountsByStudent.has(
        movement.studentId,
      )
    ) {
      amountsByStudent.set(
        movement.studentId,
        new Map(),
      );
    }

    const studentMonths =
      amountsByStudent.get(
        movement.studentId,
      );

    const current =
      studentMonths.get(month) ?? 0;

    studentMonths.set(
      month,
      current + movement.amount,
    );
  }

  const rows = students.map(
    (student) => {
      const monthAmounts =
        amountsByStudent.get(
          student.id,
        ) ?? new Map();

      const row = {
        Student_ID:
          student.id,

        DNI:
          student.dni,

        Alumno:
          student.fullName,

        Estado:
          student.status,
      };

      for (const month of months) {
        row[month] =
          monthAmounts.get(month) ??
          null;
      }

      const paidMonths =
        months.filter(
          (month) =>
            (monthAmounts.get(month) ?? 0) >
            0,
        );

      row.Meses_Con_Pago =
        paidMonths.length;

      row.Ultimo_Mes_Con_Pago =
        paidMonths.length > 0
          ? paidMonths[
              paidMonths.length - 1
            ]
          : null;

      return row;
    },
  );

  return {
    months,
    rows,
  };
}

function buildFinancialStatus(
  students,
  enrollments,
  reconciled,
) {
  /*
   * Tomamos como fecha de referencia el movimiento
   * más reciente del reporte de ControlFit.
   *
   * Esto evita depender de la fecha actual del sistema.
   */
  const validDates =
    reconciled
      .map(
        (movement) =>
          movement.date,
      )
      .filter(
        (date) =>
          date instanceof Date &&
          !Number.isNaN(
            date.getTime(),
          ),
      );

  const referenceDate =
    validDates.length > 0
      ? new Date(
          Math.max(
            ...validDates.map(
              (date) =>
                date.getTime(),
            ),
          ),
        )
      : new Date();

  /*
   * Agrupamos inscripciones por studentId.
   */
  const enrollmentsByStudent =
    new Map();

  for (
    const enrollment
    of enrollments
  ) {
    if (
      !enrollment.studentId
    ) {
      continue;
    }

    const current =
      enrollmentsByStudent.get(
        enrollment.studentId,
      ) ?? [];

    current.push(
      enrollment,
    );

    enrollmentsByStudent.set(
      enrollment.studentId,
      current,
    );
  }

  /*
   * Agrupamos únicamente pagos conciliados
   * de cuota.
   */
  const feePaymentsByStudent =
    new Map();

  for (
    const movement
    of reconciled
  ) {
    if (
      !movement.studentId
    ) {
      continue;
    }

    if (
      ![
        'EXACT',
        'EXACT_REORDERED',
      ].includes(
        movement.matchType,
      )
    ) {
      continue;
    }

    const isFeePayment =
      normalizeText(
        movement.operation,
      ).includes(
        'PAGO DE CUOTA',
      );

    if (!isFeePayment) {
      continue;
    }

    const current =
      feePaymentsByStudent.get(
        movement.studentId,
      ) ?? [];

    current.push(
      movement,
    );

    feePaymentsByStudent.set(
      movement.studentId,
      current,
    );
  }

  return students.map(
    (student) => {
      const studentEnrollments =
        enrollmentsByStudent.get(
          student.id,
        ) ?? [];

      const activeEnrollments =
        studentEnrollments.filter(
          (enrollment) =>
            enrollment.status ===
            'ACTIVE',
        );

      const endedEnrollments =
        studentEnrollments.filter(
          (enrollment) =>
            enrollment.status ===
            'ENDED',
        );

      const feePayments =
        feePaymentsByStudent.get(
          student.id,
        ) ?? [];

      const sortedFeePayments =
        [...feePayments].sort(
          (a, b) =>
            (
              b.date?.getTime() ??
              0
            ) -
            (
              a.date?.getTime() ??
              0
            ),
        );

      const lastFeePayment =
        sortedFeePayments[0] ??
        null;

      const lastFeePaymentDate =
        lastFeePayment?.date ??
        null;

      const monthsSinceLastPayment =
        lastFeePaymentDate
          ? monthsBetween(
              lastFeePaymentDate,
              referenceDate,
            )
          : null;

      /*
       * Las clases actuales se muestran
       * una sola vez aunque existiera
       * algún duplicado accidental.
       */
      const activeClasses = [
        ...new Set(
          activeEnrollments
            .map(
              (enrollment) =>
                enrollment.className,
            )
            .filter(Boolean),
        ),
      ];

      const allClasses = [
        ...new Set(
          studentEnrollments
            .map(
              (enrollment) =>
                enrollment.className,
            )
            .filter(Boolean),
        ),
      ];

      let financialStatus;

      if (
        activeEnrollments.length ===
        0
      ) {
        financialStatus =
          'SIN_INSCRIPCION_ACTIVA';
      } else if (
        feePayments.length === 0
      ) {
        financialStatus =
          'SIN_PAGOS_CUOTA';
      } else if (
        monthsSinceLastPayment ===
        0
      ) {
        financialStatus =
          'AL_DIA_PROBABLE';
      } else if (
        monthsSinceLastPayment ===
        1
      ) {
        financialStatus =
          'REVISAR_1_MES';
      } else {
        financialStatus =
          'POSIBLE_MOROSO';
      }

      return {
        Student_ID:
          student.id,

        DNI:
          student.dni,

        Alumno:
          student.fullName,

        Estado_Alumno:
          student.status,

        Total_Inscripciones:
          studentEnrollments.length,

        Inscripciones_Activas:
          activeEnrollments.length,

        Inscripciones_Finalizadas:
          endedEnrollments.length,

        Clases_Actuales:
          activeClasses.join(
            ' | ',
          ),

        Todas_Las_Clases:
          allClasses.join(
            ' | ',
          ),

        Cantidad_Pagos_Cuota:
          feePayments.length,

        Ultimo_Pago_Cuota:
          formatDate(
            lastFeePaymentDate,
          ),

        Ultimo_Mes_Pago:
          lastFeePaymentDate
            ? getMonthKey(
                lastFeePaymentDate,
              )
            : null,

        Importe_Ultimo_Pago:
          lastFeePayment?.amount ??
          null,

        Meses_Desde_Ultimo_Pago:
          monthsSinceLastPayment,

        Estado_Financiero:
          financialStatus,

        Fecha_Referencia:
          formatDate(
            referenceDate,
          ),
      };
    },
  );
}

function buildFinancialAudit(
  students,
  enrollments,
  reconciled,
  financialStatus,
) {
  const reviewStatuses = new Set([
    'REVISAR_1_MES',
    'POSIBLE_MOROSO',
    'SIN_PAGOS_CUOTA',
  ]);

  const financialByStudent =
    new Map(
      financialStatus.map(
        (row) => [
          row.Student_ID,
          row,
        ],
      ),
    );

  const enrollmentsByStudent =
    new Map();

  for (const enrollment of enrollments) {
    if (!enrollment.studentId) {
      continue;
    }

    const current =
      enrollmentsByStudent.get(
        enrollment.studentId,
      ) ?? [];

    current.push(enrollment);

    enrollmentsByStudent.set(
      enrollment.studentId,
      current,
    );
  }

  const movementsByStudent =
    new Map();

  for (const movement of reconciled) {
    if (
      !movement.studentId ||
      ![
        'EXACT',
        'EXACT_REORDERED',
      ].includes(
        movement.matchType,
      )
    ) {
      continue;
    }

    const current =
      movementsByStudent.get(
        movement.studentId,
      ) ?? [];

    current.push(movement);

    movementsByStudent.set(
      movement.studentId,
      current,
    );
  }

  const rows = [];

  for (const student of students) {
    const financial =
      financialByStudent.get(
        student.id,
      );

    if (
      !financial ||
      !reviewStatuses.has(
        financial.Estado_Financiero,
      )
    ) {
      continue;
    }

    const studentEnrollments =
      enrollmentsByStudent.get(
        student.id,
      ) ?? [];

    const activeEnrollments =
      studentEnrollments.filter(
        (enrollment) =>
          enrollment.status ===
          'ACTIVE',
      );

    const studentMovements =
      movementsByStudent.get(
        student.id,
      ) ?? [];

    const sortedMovements =
      [...studentMovements].sort(
        (a, b) =>
          (
            b.date?.getTime() ??
            0
          ) -
          (
            a.date?.getTime() ??
            0
          ),
      );

    const feePayments =
      studentMovements.filter(
        (movement) =>
          normalizeText(
            movement.operation,
          ).includes(
            'PAGO DE CUOTA',
          ),
      );

    const sortedFeePayments =
      [...feePayments].sort(
        (a, b) =>
          (
            b.date?.getTime() ??
            0
          ) -
          (
            a.date?.getTime() ??
            0
          ),
      );

    const lastMovement =
      sortedMovements[0] ??
      null;

    const lastFeePayment =
      sortedFeePayments[0] ??
      null;

    /*
     * Pagos de cuota correspondientes a 2026,
     * agrupados de forma legible.
     */
    const feePayments2026 =
      sortedFeePayments
        .filter(
          (movement) =>
            movement.date &&
            movement.date.getFullYear() ===
              2026,
        )
        .sort(
          (a, b) =>
            (
              a.date?.getTime() ??
              0
            ) -
            (
              b.date?.getTime() ??
              0
            ),
        )
        .map(
          (movement) =>
            `${formatDate(
              movement.date,
            )}: $${movement.amount}`,
        )
        .join(' | ');

    /*
     * Últimos movimientos, no solo cuotas.
     */
    const recentMovements =
      sortedMovements
        .slice(0, 5)
        .map(
          (movement) =>
            `${formatDate(
              movement.date,
            )} - ${movement.operation} - $${movement.amount}`,
        )
        .join(' | ');

    const activeClasses = [
      ...new Set(
        activeEnrollments
          .map(
            (enrollment) =>
              enrollment.className,
          )
          .filter(Boolean),
      ),
    ];

    let observation = '';

    if (
      financial.Estado_Financiero ===
      'SIN_PAGOS_CUOTA'
    ) {
      observation =
        'No se encontraron movimientos "Pago de cuota". Revisar si paga bajo otro concepto o si la inscripción es reciente.';
    }

    if (
      financial.Estado_Financiero ===
      'REVISAR_1_MES'
    ) {
      observation =
        'Último pago registrado hace 1 mes. Revisar si el pago corresponde al período actual o si existe deuda.';
    }

    if (
      financial.Estado_Financiero ===
      'POSIBLE_MOROSO'
    ) {
      observation =
        'Último pago de cuota registrado hace 2 o más meses. No asumir deuda automáticamente: revisar movimientos e historial.';
    }

    rows.push({
      Student_ID:
        student.id,

      DNI:
        student.dni,

      Alumno:
        student.fullName,

      Estado_Alumno:
        student.status,

      Clasificacion:
        financial.Estado_Financiero,

      Inscripciones_Activas:
        activeEnrollments.length,

      Clases_Actuales:
        activeClasses.join(
          ' | ',
        ),

      Cantidad_Pagos_Cuota:
        feePayments.length,

      Ultimo_Pago_Cuota:
        formatDate(
          lastFeePayment?.date ??
            null,
        ),

      Importe_Ultimo_Pago:
        lastFeePayment?.amount ??
        null,

      Meses_Desde_Ultimo_Pago:
        financial.Meses_Desde_Ultimo_Pago,

      Pagos_Cuota_2026:
        feePayments2026,

      Ultimo_Movimiento:
        formatDate(
          lastMovement?.date ??
            null,
        ),

      Ultima_Operacion:
        lastMovement?.operation ??
        null,

      Importe_Ultimo_Movimiento:
        lastMovement?.amount ??
        null,

      Ultimos_5_Movimientos:
        recentMovements,

      Observacion:
        observation,
    });
  }

  return rows.sort(
    (a, b) => {
      const priority = {
        SIN_PAGOS_CUOTA: 1,
        POSIBLE_MOROSO: 2,
        REVISAR_1_MES: 3,
      };

      return (
        priority[a.Clasificacion] -
        priority[b.Clasificacion]
      );
    },
  );
}

function buildGroupedUnmatched(
  reconciled,
) {
  const unmatched =
    reconciled.filter(
      (movement) =>
        movement.matchType ===
          'NO_MATCH' ||
        movement.matchType ===
          'NO_MEMBER',
    );

  const grouped =
    new Map();

  for (const movement of unmatched) {
    const name =
      movement.memberName
        ? normalizeName(
            movement.memberName,
          )
        : '(SIN NOMBRE)';

    if (!grouped.has(name)) {
      grouped.set(name, {
        Nombre_ControlFit:
          movement.memberName ??
          '(SIN NOMBRE)',

        Nombre_Normalizado:
          name,

        Cantidad_Movimientos:
          0,

        Pagos_Cuota:
          0,

        Total_Movimientos:
          0,

        Total_Cuotas:
          0,

        Primer_Movimiento:
          null,

        Ultimo_Movimiento:
          null,

        Mejor_Candidato_Carmesi:
          movement.studentFullName ??
          null,

        Mejor_Similitud:
          movement.matchScore ?? 0,
      });
    }

    const group =
      grouped.get(name);

    group.Cantidad_Movimientos++;

    group.Total_Movimientos +=
      movement.amount ?? 0;

    const isFeePayment =
      normalizeText(
        movement.operation,
      ).includes(
        'PAGO DE CUOTA',
      );

    if (isFeePayment) {
      group.Pagos_Cuota++;

      group.Total_Cuotas +=
        movement.amount ?? 0;
    }

    if (movement.date) {
      if (
        !group.Primer_Movimiento ||
        movement.date <
          group.Primer_Movimiento
      ) {
        group.Primer_Movimiento =
          movement.date;
      }

      if (
        !group.Ultimo_Movimiento ||
        movement.date >
          group.Ultimo_Movimiento
      ) {
        group.Ultimo_Movimiento =
          movement.date;
      }
    }

    /*
     * Conservamos el mejor candidato fuzzy,
     * aunque haya quedado debajo del threshold.
     */
    if (
      (movement.matchScore ?? 0) >
      (group.Mejor_Similitud ?? 0)
    ) {
      group.Mejor_Similitud =
        movement.matchScore;

      group.Mejor_Candidato_Carmesi =
        movement.studentFullName;
    }
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,

      Primer_Movimiento:
        formatDate(
          group.Primer_Movimiento,
        ),

      Ultimo_Movimiento:
        formatDate(
          group.Ultimo_Movimiento,
        ),
    }))
    .sort(
      (a, b) =>
        b.Cantidad_Movimientos -
        a.Cantidad_Movimientos,
    );
}
async function writeReport(
  reconciled,
  studentSummary,
  students,
  enrollments,
) {
  await fs.mkdir(
    OUTPUT_DIR,
    {
      recursive: true,
    },
  );

  const workbook =
    utils.book_new();

  const paymentsByMonth =
    buildPaymentsByMonth(
      students,
      reconciled,
    );

  const groupedUnmatched =
    buildGroupedUnmatched(
      reconciled,
    );
    const financialStatus =
    buildFinancialStatus(
        students,
        enrollments,
        reconciled,
    );
    const financialAudit =
    buildFinancialAudit(
      students,
      enrollments,
      reconciled,
      financialStatus,
    );
  const exact =
    reconciled.filter(
      (movement) =>
        [
          'EXACT',
          'EXACT_REORDERED',
        ].includes(
          movement.matchType,
        ),
    );

  const fuzzy =
    reconciled.filter(
      (movement) =>
        movement.matchType ===
        'FUZZY',
    );

  const noMatch =
    reconciled.filter(
      (movement) =>
        movement.matchType ===
          'NO_MATCH' ||
        movement.matchType ===
          'NO_MEMBER',
    );

  const summaryData =
    studentSummary.map(
      (student) => ({
        Student_ID:
          student.studentId,

        DNI:
          student.dni,

        Alumno:
          student.fullName,

        Estado:
          student.status,

        Movimientos:
          student.movementsCount,

        Pagos_Cuota:
          student.feePaymentsCount,

        Total_Movimientos:
          student.totalAmount,

        Total_Cuotas:
          student.totalFeeAmount,

        Ultimo_Movimiento:
          formatDate(
            student.lastMovementDate,
          ),

        Ultimo_Tipo:
          student.lastMovementType,

        Ultimo_Pago_Cuota:
          formatDate(
            student.lastFeePaymentDate,
          ),

        Tiene_Historial:
          student.hasHistory,
      }),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      summaryData,
    ),
    'Alumnos',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      exact.map(
        movementForExcel,
      ),
    ),
    'Conciliados',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      fuzzy.map(
        movementForExcel,
      ),
    ),
    'Revisar fuzzy',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      noMatch.map(
        movementForExcel,
      ),
    ),
    'No encontrados',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      reconciled.map(
        movementForExcel,
      ),
    ),
    'Todos movimientos',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      groupedUnmatched,
    ),
    'No encontrados agrupados',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      paymentsByMonth.rows,
    ),
    'Pagos por mes',
  );
  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
        financialStatus,
    ),
    'Estado financiero',
    );
  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
        financialAudit,
    ),
    'Auditoria financiera',
    );  
  const outputPath =
    path.join(
      OUTPUT_DIR,
      'conciliacion-pagos.xlsx',
    );
  
  writeFile(
    workbook,
    outputPath,
  );

  return outputPath;
}
/* ---------------------------------------------------------
 * Main
 * --------------------------------------------------------- */

async function main() {
  try {
    console.log(
      '📥 Leyendo estudiantes actuales...',
    );

    const students =
      await loadStudents();

    console.log(
      `👥 Estudiantes: ${students.length}`,
    );

    console.log(
  '📥 Leyendo inscripciones actuales...',
    );

    const enrollments =
    await loadEnrollments();

    console.log(
    `📚 Inscripciones: ${enrollments.length}`,
    );

    console.log(
      '📥 Leyendo movimientos de ControlFit...',
    );

    const movements =
      loadCashMovements();

    console.log(
      `💰 Movimientos: ${movements.length}`,
    );

    console.log(
      '🔎 Conciliando...',
    );

    const reconciled =
      reconcile(
        movements,
        students,
      );

    const exact =
      reconciled.filter(
        (movement) =>
          [
            'EXACT',
            'EXACT_REORDERED',
          ].includes(
            movement.matchType,
          ),
      );

    const fuzzy =
      reconciled.filter(
        (movement) =>
          movement.matchType ===
          'FUZZY',
      );

    const noMatch =
      reconciled.filter(
        (movement) =>
          movement.matchType ===
            'NO_MATCH' ||
          movement.matchType ===
            'NO_MEMBER',
      );

    const exactStudentIds =
      new Set(
        exact
          .map(
            (movement) =>
              movement.studentId,
          )
          .filter(Boolean),
      );

    const studentSummary =
      buildStudentSummary(
        students,
        reconciled,
      );
    const paymentsByMonth =
  buildPaymentsByMonth(
    students,
    reconciled,
  );

const groupedUnmatched =
  buildGroupedUnmatched(
    reconciled,
  );

    console.log('');
    console.log(
      '📊 RESULTADO DE CONCILIACIÓN',
    );

    console.log(
      `✅ Movimientos conciliados exactos: ${exact.length}`,
    );

    console.log(
      `⚠️ Movimientos fuzzy para revisar: ${fuzzy.length}`,
    );

    console.log(
      `❌ Movimientos no encontrados: ${noMatch.length}`,
    );

    console.log(
      `👥 Alumnos actuales con historial: ${exactStudentIds.size}`,
    );

    console.log(
      `👤 Alumnos actuales sin historial: ${
        students.length -
        exactStudentIds.size
      }`,
    );
    console.log(
    `📅 Meses analizados: ${paymentsByMonth.months.length}`,
    );

    console.log(
    `👻 Socios históricos no encontrados: ${groupedUnmatched.length}`,
    );

    const outputPath =
        await writeReport(
            reconciled,
            studentSummary,
            students,
            enrollments,
        );

    console.log('');
    console.log(
      '✅ Conciliación terminada.',
    );

        const financialStatus =
    buildFinancialStatus(
        students,
        enrollments,
        reconciled,
    );
    const financialAudit =
  buildFinancialAudit(
    students,
    enrollments,
    reconciled,
    financialStatus,
  );

    const financialCounts =
    financialStatus.reduce(
        (acc, row) => {
        const key =
            row.Estado_Financiero;

        acc[key] =
            (acc[key] ?? 0) + 1;

        return acc;
        },
        {},
    );

    console.log('');
    console.log(
    '💳 ESTADO FINANCIERO PRELIMINAR',
    );

    for (
    const [
        status,
        count,
    ] of Object.entries(
        financialCounts,
    )
    ) {
  console.log(
    `   ${status}: ${count}`,
  );
}

console.log(
  `🔎 Casos para auditoría: ${financialAudit.length}`,
);
    console.log(
      `📄 Reporte: ${outputPath}`,
    );

    console.log('');
    console.log(
      '⚠️ Los matches FUZZY no se consideran conciliados automáticamente.',
    );
  } catch (error) {
    console.error('');
    console.error(
      '❌ Error conciliando movimientos:',
    );

    console.error(
      error.stack ??
      error.message,
    );

    process.exit(1);
  }
}

await main();