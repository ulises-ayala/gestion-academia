import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import xlsx from 'xlsx';

loadEnvFile('.env');

const {
  readFile,
  utils,
} = xlsx;

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

/*
 * Cambiá el nombre solamente si tu archivo local
 * se llama distinto.
 */
const HISTORY_FILE = path.resolve(
  './scripts/data/Historial_Para_Mariano_CORREGIDO_ACTIVOS.xlsx',
);

const ENROLLMENTS_FILE = path.resolve(
  './exports/enrollments-current.json',
);
const STUDENTS_FILE = path.resolve(
  './exports/students-current.json',
);

const OUTPUT_DIR = path.resolve(
  './exports',
);

const REPORT_FILE = path.join(
  OUTPUT_DIR,
  'migracion-historial-enrollments.json',
);

/*
 * Esta es la fecha provisoria que usamos cuando
 * importamos las inscripciones originalmente.
 *
 * Por defecto solamente reemplazaremos:
 *
 * null
 * o
 * 2026-08-28
 */
const PLACEHOLDER_START_DATE =
  '2026-08-28';

/*
 * Solo --apply escribe en la BDD.
 */
const APPLY =
  process.argv.includes('--apply');

const CHECK_FILE =
  process.argv.includes('--check-file');

const REPLACE_ANY_START_DATE =
  process.argv.includes(
    '--replace-any-start-date',
  );

/*
 * IMPORTANTE:
 *
 * Acá podemos declarar equivalencias entre nombres
 * de actividades del Excel original y las clases
 * que creamos en Carmesí.
 *
 * La izquierda debe ser la actividad del Excel.
 * La derecha, className de Carmesí.
 */
const ACTIVITY_CLASS_MAP = {
  'ARABE INFANTIL':
    'Árabe infantil',

    'COREOGRAFICO E MASC BACHATA URBAN':
     'Coreografico E.Masc- Bachata/Urban',

  'BACHATA Y SALSA INICIAL':
    'Bachata y Salsa Inicial',

  'COREGRAFICO FRANK':
    'Grupo C. - A.Frank',

  'COREOGRAFICO FRANK':
    'Grupo C. - A.Frank',

  'COREGRAFICO PUCHINI':
    'Grupo C. Sofi',

  'COREOGRAFICO PUCHINI':
    'Grupo C. Sofi',

  'ESTILO FEMENINO':
    'Clase femenino Sofi',

  'FORMACION DOCENTE EN RITMOS CARIBENOS Y KIZOMBA':
    'Formacion Docente En Ritmos Caribeños Y Kizomba',

  'HEELS':
    'Hells',

  'INFANTIL 1':
    'Infantil (6 a 7 años)',

  'KIDS':
    'Kids 4-5 años',

  'KIZOMBA':
    'Clase kizomba',

  'LADYS KIZZ':
    'Ladys Kizz',

  'MAMBO EN PAREJA':
    'Mambo en parejas',

  'SALSA Y BACHATA EN PAREJA FABI':
    'S&B Parejas',

  'STREET COREOGRAFICO ADULTO':
    'S.C Adultos (+18 años)',

  'STREET COREOGRAFICO AVANZADO INTERMEDIO':
    'Street Int/Avanzado',

  'STREET INT AVANZADO':
    'Street Int/Avanzado',

  'STREET COREOGRAFICO INFANTIL':
    'S.C Infantil (6-11 años)',

  'STREET COREOGRAFICO JUVENIL':
    'S.C Juvenil (12-17 años)',

  'TANGO INTER AVANZ':
    'Tango (Inter/Avanz)',

  'TEENS':
    'Teens (8 a 12 años)',

  'ZUMBA':
    'Zumba - Profe Joselo',

  'LADYS TRAINING':
    'Clase LT - A.Frank',
};

/* =========================================================
 * NORMALIZACIÓN
 * ========================================================= */

function normalizeText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value)
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .toUpperCase()
    .replace(
      /[.,;:'"()[\]{}]/g,
      ' ',
    )
    .replace(
      /[-_/\\]/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function normalizeName(value) {
  return normalizeText(value);
}

function sortedName(value) {
  return normalizeName(value)
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');
}

function getEnrollmentStudentName(enrollment) {
  return (
    enrollment.studentName ??
    enrollment.raw?.student?.fullName ??
    [
      enrollment.raw?.student?.lastName,
      enrollment.raw?.student?.firstName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
  );
}

function normalizeDni(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .trim();
}

function getEnrollmentStudentDni(enrollment) {
  return normalizeDni(
    enrollment.dni ??
    enrollment.raw?.student?.dni,
  );
}

/* =========================================================
 * MESES / FECHAS
 * ========================================================= */

const MONTH_NAMES = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SEPTIEMBRE: 9,
  SETIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12,
};

function monthToStartDate(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  /*
   * Si XLSX devuelve una Date.
   */
  if (value instanceof Date) {
    if (
      Number.isNaN(
        value.getTime(),
      )
    ) {
      return null;
    }

    const year =
      value.getFullYear();

    const month =
      String(
        value.getMonth() + 1,
      ).padStart(
        2,
        '0',
      );

    return `${year}-${month}-01`;
  }

  const text =
    String(value)
      .trim();

  /*
   * 03/2025
   * 3/2025
   */
  let match =
    text.match(
      /^(0?[1-9]|1[0-2])\/(\d{4})$/,
    );

  if (match) {
    const month =
      match[1].padStart(
        2,
        '0',
      );

    const year =
      match[2];

    return `${year}-${month}-01`;
  }

  /*
   * 2025-03
   */
  match =
    text.match(
      /^(\d{4})-(0?[1-9]|1[0-2])$/,
    );

  if (match) {
    const year =
      match[1];

    const month =
      match[2].padStart(
        2,
        '0',
      );

    return `${year}-${month}-01`;
  }

  /*
   * marzo 2025
   * Marzo/2025
   */
  const normalized =
    normalizeText(text);

  match =
    normalized.match(
      /^([A-Z]+)\s+(\d{4})$/,
    );

  if (match) {
    const monthNumber =
      MONTH_NAMES[
        match[1]
      ];

    if (monthNumber) {
      return `${
        match[2]
      }-${String(
        monthNumber,
      ).padStart(
        2,
        '0',
      )}-01`;
    }
  }

  return null;
}

/* =========================================================
 * LEVENSHTEIN / SIMILITUD
 * ========================================================= */

function levenshtein(a, b) {
  const matrix =
    Array.from(
      {
        length:
          b.length + 1,
      },
      () =>
        Array(
          a.length + 1,
        ).fill(0),
    );

  for (
    let i = 0;
    i <= b.length;
    i++
  ) {
    matrix[i][0] = i;
  }

  for (
    let j = 0;
    j <= a.length;
    j++
  ) {
    matrix[0][j] = j;
  }

  for (
    let i = 1;
    i <= b.length;
    i++
  ) {
    for (
      let j = 1;
      j <= a.length;
      j++
    ) {
      const cost =
        b[i - 1] ===
        a[j - 1]
          ? 0
          : 1;

      matrix[i][j] =
        Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] +
            cost,
        );
    }
  }

  return matrix[
    b.length
  ][a.length];
}

function similarity(a, b) {
  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  const distance =
    levenshtein(
      a,
      b,
    );

  const maxLength =
    Math.max(
      a.length,
      b.length,
    );

  if (maxLength === 0) {
    return 1;
  }

  return (
    1 -
    distance /
      maxLength
  );
}

/* =========================================================
 * DETECCIÓN DE COLUMNAS DEL EXCEL
 * ========================================================= */

function findColumn(
  row,
  aliases,
) {
  const keys =
    Object.keys(row);

  for (
    const alias
    of aliases
  ) {
    const normalizedAlias =
      normalizeText(alias);

    const found =
      keys.find(
        (key) =>
          normalizeText(key) ===
          normalizedAlias,
      );

    if (found) {
      return found;
    }
  }

  return null;
}

function splitActivities(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return [];
  }

  /*
   * NO dividimos por "/"
   * porque hay actividades
   * como Salsa/Bachata.
   */
  return String(value)
    .split(
      /\r?\n|;|\|/,
    )
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean);
}

/* =========================================================
 * LECTURA DEL EXCEL
 * ========================================================= */

function loadHistoryExcel() {
  const workbook =
    readFile(
      HISTORY_FILE,
      {
        cellDates: true,
      },
    );

  if (
    workbook.SheetNames.length ===
    0
  ) {
    throw new Error(
      'El Excel no contiene hojas.',
    );
  }

  const sheetName =
    workbook.SheetNames[0];

  const sheet =
    workbook.Sheets[
      sheetName
    ];

  const rows =
    utils.sheet_to_json(
      sheet,
      {
        defval: null,
      },
    );

  if (
    rows.length === 0
  ) {
    throw new Error(
      'El Excel no contiene filas.',
    );
  }

  const firstRow =
    rows[0];

  const studentColumn =
    findColumn(
      firstRow,
      [
        'Alumno',
        'Nombre completo',
        'Nombre y apellido',
        'Socio',
      ],
    );

  const firstNameColumn =
    findColumn(
      firstRow,
      [
        'Nombre',
        'Nombres',
      ],
    );

  const lastNameColumn =
    findColumn(
      firstRow,
      [
        'Apellido',
        'Apellidos',
      ],
    );

  const activityColumn =
    findColumn(
      firstRow,
      [
        'Actividad',
        'Actividades',
        'Clase',
        'Clases',
      ],
    );

  const startColumn =
    findColumn(
      firstRow,
      [
        'Inicio aprox.',
        'Inicio aprox',
        'Inicio',
        'Mes inicio',
        'Mes de inicio',
        'Inicio de pago',
        'Inicio pago',
        'Inicio de actividad',
      ],
    );

  const dniColumn =
    findColumn(
      firstRow,
      [
        'DNI',
        'Documento',
      ],
    );

  console.log('');
  console.log(
    '📋 Columnas detectadas:',
  );

  console.log(
    `   Alumno: ${
      studentColumn ??
      '(nombre + apellido)'
    }`,
  );

  console.log(
    `   Nombre: ${
      firstNameColumn ??
      '-'
    }`,
  );

  console.log(
    `   Apellido: ${
      lastNameColumn ??
      '-'
    }`,
  );

  console.log(
    `   DNI: ${
      dniColumn ??
      '-'
    }`,
  );

  console.log(
    `   Actividad: ${
      activityColumn ??
      'NO ENCONTRADA'
    }`,
  );

  console.log(
    `   Inicio: ${
      startColumn ??
      'NO ENCONTRADA'
    }`,
  );

  if (
    !studentColumn &&
    !(
      firstNameColumn &&
      lastNameColumn
    )
  ) {
    throw new Error(
      'No pude identificar la columna del nombre del alumno.',
    );
  }

  if (
    !activityColumn
  ) {
    throw new Error(
      'No pude identificar la columna de actividad.',
    );
  }

  if (!startColumn) {
    throw new Error(
      'No pude identificar la columna del mes de inicio.',
    );
  }

  const history = [];

  for (
    let index = 0;
    index <
    rows.length;
    index++
  ) {
    const row =
      rows[index];

    let fullName;

    if (studentColumn) {
      fullName =
        String(
          row[
            studentColumn
          ] ?? '',
        ).trim();
    } else {
      fullName =
        [
          row[
            lastNameColumn
          ],
          row[
            firstNameColumn
          ],
        ]
          .filter(Boolean)
          .join(' ')
          .trim();
    }

    if (!fullName) {
      continue;
    }

    const activities =
      splitActivities(
        row[
          activityColumn
        ],
      );

    const startMonth =
      row[startColumn];

    const startDate =
      monthToStartDate(
        startMonth,
      );

    const dni =
      dniColumn &&
      row[dniColumn] !==
        null
        ? String(
            row[
              dniColumn
            ],
          ).trim()
        : null;

    /*
     * Creamos una relación
     * alumno-actividad por cada
     * actividad encontrada.
     */
    if (
      activities.length ===
      0
    ) {
      history.push({
        excelRow:
          index + 2,

        fullName,

        dni,

        activity:
          null,

        startMonth,

        startDate,
      });

      continue;
    }

    for (
      const activity
      of activities
    ) {
      history.push({
        excelRow:
          index + 2,

        fullName,

        dni,

        activity,

        startMonth,

        startDate,
      });
    }
  }

  return history;
}

/* =========================================================
 * LECTURA DE INSCRIPCIONES
 * ========================================================= */

async function loadEnrollments() {
  const raw =
    await fs.readFile(
      ENROLLMENTS_FILE,
      'utf8',
    );

  const enrollments =
    JSON.parse(raw);

  if (
    !Array.isArray(
      enrollments,
    )
  ) {
    throw new Error(
      'enrollments-current.json no contiene un array.',
    );
  }

  return enrollments;
}

async function loadStudents() {
  const raw =
    await fs.readFile(
      STUDENTS_FILE,
      'utf8',
    );

  const students =
    JSON.parse(raw);

  if (
    !Array.isArray(
      students,
    )
  ) {
    throw new Error(
      'students-current.json no contiene un array.',
    );
  }

  return students;
}

function findStudent(
  historyRow,
  students,
) {
  if (
    historyRow.dni
  ) {
    const historyDni =
      String(
        historyRow.dni,
      )
        .replace(/\D/g, '')
        .trim();

    const byDni =
      students.find(
        (student) =>
          String(
            student.dni ??
            '',
          )
            .replace(/\D/g, '')
            .trim() ===
          historyDni,
      );

    if (
      byDni
    ) {
      return {
        type: 'DNI',
        student: byDni,
      };
    }
  }

  const normalized =
    normalizeName(
      historyRow.fullName,
    );

  const exact =
    students.find(
      (student) =>
        normalizeName(
          student.fullName,
        ) === normalized,
    );

  if (
    exact
  ) {
    return {
      type:
        'EXACT_NAME',

      student:
        exact,
    };
  }

  const sorted =
    sortedName(
      historyRow.fullName,
    );

  const reordered =
    students.find(
      (student) =>
        sortedName(
          student.fullName,
        ) === sorted,
    );

  if (
    reordered
  ) {
    return {
      type:
        'EXACT_REORDERED',

      student:
        reordered,
    };
  }

  return {
    type:
      'NO_STUDENT',

    student:
      null,
  };
}

/* =========================================================
 * MATCH DEL ALUMNO
 * ========================================================= */

function findStudentEnrollments(
  historyRow,
  enrollments,
) {
  /*
   * 1. DNI
   */
  if (historyRow.dni) {
    const historyDni =
      normalizeDni(
        historyRow.dni,
      );

    const byDni =
      enrollments.filter(
        (enrollment) =>
          getEnrollmentStudentDni(
            enrollment,
          ) === historyDni,
      );

    if (
      byDni.length > 0
    ) {
      return {
        type: 'DNI',
        enrollments:
          byDni,
      };
    }
  }

  /*
   * 2. Nombre exacto
   */
  const normalized =
    normalizeName(
      historyRow.fullName,
    );

  const exact =
    enrollments.filter(
      (enrollment) =>
        normalizeName(
          getEnrollmentStudentName(
            enrollment,
          ),
        ) === normalized,
    );

  if (
    exact.length > 0
  ) {
    return {
      type:
        'EXACT_NAME',

      enrollments:
        exact,
    };
  }

  /*
   * 3. Mismo nombre ignorando
   * el orden de las palabras.
   *
   * Ejemplo:
   *
   * ALBARRACIN MICAELA
   * MICAELA ALBARRACIN
   */
  const sorted =
    sortedName(
      historyRow.fullName,
    );

  const reordered =
    enrollments.filter(
      (enrollment) =>
        sortedName(
          getEnrollmentStudentName(
            enrollment,
          ),
        ) === sorted,
    );

  if (
    reordered.length > 0
  ) {
    return {
      type:
        'EXACT_REORDERED',

      enrollments:
        reordered,
    };
  }

  /*
   * 4. No hacemos fuzzy automático.
   *
   * Pero buscamos los candidatos
   * más parecidos para incluirlos
   * en el reporte.
   */
  const candidatesByStudent =
    new Map();

  for (
    const enrollment
    of enrollments
  ) {
    const name =
      getEnrollmentStudentName(
        enrollment,
      );

    if (!name) {
      continue;
    }

    const key =
      normalizeName(name);

    if (
      candidatesByStudent.has(
        key,
      )
    ) {
      continue;
    }

    const directScore =
      similarity(
        normalized,
        normalizeName(name),
      );

    const sortedScore =
      similarity(
        sorted,
        sortedName(name),
      );

    candidatesByStudent.set(
      key,
      {
        name,
        score:
          Math.max(
            directScore,
            sortedScore,
          ),
      },
    );
  }

  const possibleStudents =
    [
      ...candidatesByStudent.values(),
    ]
      .sort(
        (a, b) =>
          b.score -
          a.score,
      )
      .slice(
        0,
        5,
      )
      .map(
        (candidate) => ({
          name:
            candidate.name,

          score:
            Number(
              candidate.score
                .toFixed(4),
            ),
        }),
      );

  return {
    type:
      'NO_STUDENT',

    enrollments:
      [],

    possibleStudents,
  };
}

/* =========================================================
 * MATCH DE ACTIVIDAD ↔ CLASE
 * ========================================================= */

function resolveMappedClass(
  activity,
) {
  const normalizedActivity =
    normalizeText(activity);

  return (
    ACTIVITY_CLASS_MAP[
      normalizedActivity
    ] ??
    null
  );
}

function findEnrollmentForActivity(
  activity,
  candidateEnrollments,
) {
  if (!activity) {
    return {
      type:
        'NO_ACTIVITY',

      enrollment:
        null,

      score:
        0,
    };
  }

  const normalizedActivity =
    normalizeText(activity);

  /*
   * 1. Alias explícito.
   */
  const mappedClass =
    resolveMappedClass(
      activity,
    );

  if (mappedClass) {
  const mapped =
    candidateEnrollments.find(
      (enrollment) =>
        normalizeText(
          enrollment.className,
        ) ===
        normalizeText(
          mappedClass,
        ),
    );

  if (mapped) {
    return {
      type:
        'ACTIVITY_MAP',

      enrollment:
        mapped,

      mappedClass,

      score:
        1,
    };
  }

  /*
   * Conocemos la equivalencia de la actividad,
   * pero el alumno no tiene actualmente
   * un enrollment a esa clase.
   */
  return {
    type:
      'HISTORICAL_CLASS_NOT_ENROLLED',

    enrollment:
      null,

    mappedClass,

    score:
      1,
  };
  
  }

  /*
   * 2. Nombre exacto.
   */
  const exact =
    candidateEnrollments.find(
      (enrollment) =>
        normalizeText(
          enrollment.className,
        ) ===
        normalizedActivity,
    );

  if (exact) {
    return {
      type:
        'EXACT_CLASS',

      enrollment:
        exact,

      score:
        1,
    };
  }

  /*
   * 3. Buscamos el mejor candidato
   * solo para el reporte.
   *
   * NO actualizamos automáticamente
   * un fuzzy.
   */
  let best = null;
  let bestScore = 0;

  for (
    const enrollment
    of candidateEnrollments
  ) {
    const score =
      similarity(
        normalizedActivity,
        normalizeText(
          enrollment.className,
        ),
      );

    if (
      score >
      bestScore
    ) {
      bestScore =
        score;

      best =
        enrollment;
    }
  }

  return {
    type:
      'REVIEW_CLASS',

    enrollment:
      best,

    score:
      Number(
        bestScore.toFixed(4),
      ),
  };
}

/* =========================================================
 * AUTENTICACIÓN API
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

  /*
   * academy_session=xxxx
   */
  return setCookie
    .split(';')[0];
}

/* =========================================================
 * PATCH ENROLLMENT
 * ========================================================= */

async function updateEnrollmentStartDate(
  enrollmentId,
  startDate,
  sessionCookie,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/enrollments/${enrollmentId}`,
      {
        method:
          'PATCH',

        headers: {
          'Content-Type':
            'application/json',

          Cookie:
            sessionCookie,
        },

        body:
          JSON.stringify({
            startDate,
          }),
      },
    );

  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `${response.status}: ${body}`,
    );
  }

  return response.json();
}

/* =========================================================
 * DECISIÓN DE ACTUALIZACIÓN
 * ========================================================= */

function canReplaceStartDate(
  currentDate,
) {
  if (
    !currentDate
  ) {
    return true;
  }

  if (
    currentDate ===
    PLACEHOLDER_START_DATE
  ) {
    return true;
  }

  return (
    REPLACE_ANY_START_DATE
  );
}

/* =========================================================
 * PROCESAMIENTO
 * ========================================================= */

async function processHistory(
  history,
  enrollments,
  students,
) {
  let sessionCookie =
    null;

  if (APPLY) {
    console.log('');
    console.log(
      '🔐 Iniciando sesión...',
    );

    sessionCookie =
      await login();

    console.log(
      '✅ Sesión iniciada.',
    );
  }

  const report = [];

  for (
    const row
    of history
  ) {
    /*
     * 1. Fecha válida.
     */
    if (!row.startDate) {
      report.push({
        ...row,

        result:
          'MISSING_DATE',

        currentStartDate:
          null,

        newStartDate:
          null,
      });

      continue;
    }

    /*
     * 2. Encontramos alumno.
     */
    const studentMatch =
      findStudentEnrollments(
        row,
        enrollments,
      );

if (
  studentMatch
    .enrollments
    .length === 0
) {
  /*
   * No apareció entre enrollments,
   * pero todavía puede existir como Student.
   */
  const directStudent =
    findStudent(
      row,
      students,
    );

  if (
    directStudent.student
  ) {
    report.push({
      ...row,

      studentMatch:
        directStudent.type,

      studentId:
        directStudent
          .student
          .id,

      studentStatus:
        directStudent
          .student
          .status,

      result:
        'STUDENT_WITHOUT_ENROLLMENT',
    });

    continue;
  }

  /*
   * Realmente no existe ni como Student.
   */
  report.push({
    ...row,

    studentMatch:
      studentMatch.type,

    possibleStudents:
      studentMatch
        .possibleStudents ??
      [],

    result:
      'MISSING_STUDENT',
  });

  continue;
}

    /*
     * 3. Encontramos inscripción/clase.
     */
    const classMatch =
      findEnrollmentForActivity(
        row.activity,
        studentMatch
          .enrollments,
      );

    if (
        classMatch.type ===
        'HISTORICAL_CLASS_NOT_ENROLLED'
        ) {
        report.push({
            ...row,

            studentMatch:
            studentMatch.type,

            classMatch:
            classMatch.type,

            mappedClass:
            classMatch.mappedClass,

            result:
            'HISTORICAL_CLASS_NOT_ENROLLED',
        });

        continue;
        }  

    if (
      !classMatch.enrollment
    ) {
      report.push({
        ...row,

        studentMatch:
          studentMatch.type,

        classMatch:
          classMatch.type,

        result:
          'MISSING_CLASS',
      });

      continue;
    }

    /*
     * Los fuzzy solo se reportan.
     * Nunca los aplicamos automáticamente.
     */
    if (
      classMatch.type ===
      'REVIEW_CLASS'
    ) {
      report.push({
        ...row,

        studentMatch:
          studentMatch.type,

        classMatch:
          classMatch.type,

        matchScore:
          classMatch.score,

        candidateClass:
          classMatch
            .enrollment
            .className,

        enrollmentId:
          classMatch
            .enrollment
            .id,

        currentStartDate:
          classMatch
            .enrollment
            .startDate,

        newStartDate:
          row.startDate,

        result:
          'REVIEW_CLASS_MATCH',
      });

      continue;
    }

    const enrollment =
      classMatch.enrollment;

    /*
     * 4. Ya tiene la misma fecha.
     */
    if (
      enrollment.startDate ===
      row.startDate
    ) {
      report.push({
        ...row,

        studentMatch:
          studentMatch.type,

        classMatch:
          classMatch.type,

        enrollmentId:
          enrollment.id,

        className:
          enrollment.className,

        currentStartDate:
          enrollment.startDate,

        newStartDate:
          row.startDate,

        result:
          'UNCHANGED',
      });

      continue;
    }

    /*
     * 5. Protegemos fechas existentes.
     */
    if (
      !canReplaceStartDate(
        enrollment.startDate,
      )
    ) {
      report.push({
        ...row,

        studentMatch:
          studentMatch.type,

        classMatch:
          classMatch.type,

        enrollmentId:
          enrollment.id,

        className:
          enrollment.className,

        currentStartDate:
          enrollment.startDate,

        newStartDate:
          row.startDate,

        result:
          'PROTECTED_EXISTING_DATE',
      });

      continue;
    }

    /*
     * DRY RUN.
     */
    if (!APPLY) {
      report.push({
        ...row,

        studentMatch:
          studentMatch.type,

        classMatch:
          classMatch.type,

        enrollmentId:
          enrollment.id,

        className:
          enrollment.className,

        currentStartDate:
          enrollment.startDate,

        newStartDate:
          row.startDate,

        result:
          'WOULD_UPDATE',
      });

      continue;
    }

    /*
     * APPLY real.
     */
    try {
      await updateEnrollmentStartDate(
        enrollment.id,
        row.startDate,
        sessionCookie,
      );

      report.push({
        ...row,

        studentMatch:
          studentMatch.type,

        classMatch:
          classMatch.type,

        enrollmentId:
          enrollment.id,

        className:
          enrollment.className,

        currentStartDate:
          enrollment.startDate,

        newStartDate:
          row.startDate,

        result:
          'UPDATED',
      });

      /*
       * Actualizamos también la copia local
       * para evitar dobles modificaciones.
       */
      enrollment.startDate =
        row.startDate;
    } catch (error) {
      report.push({
        ...row,

        studentMatch:
          studentMatch.type,

        classMatch:
          classMatch.type,

        enrollmentId:
          enrollment.id,

        className:
          enrollment.className,

        currentStartDate:
          enrollment.startDate,

        newStartDate:
          row.startDate,

        result:
          'ERROR',

        error:
          error.message,
      });
    }
  }

  return report;
}

/* =========================================================
 * RESUMEN
 * ========================================================= */

function printSummary(
  report,
) {
  const counts =
    report.reduce(
      (acc, row) => {
        acc[row.result] =
          (
            acc[
              row.result
            ] ?? 0
          ) + 1;

        return acc;
      },
      {},
    );

  console.log('');
  console.log(
    '📊 RESULTADO DE MIGRACIÓN',
  );

  const labels = {
    WOULD_UPDATE:
      '🟡 Se actualizarían',

    UPDATED:
      '✅ Actualizadas',

    UNCHANGED:
      '🟢 Ya tenían la fecha',

    MISSING_DATE:
      '⚠️ Sin fecha válida',

    MISSING_STUDENT:
      '❌ Alumno no encontrado',

    MISSING_CLASS:
      '❌ Clase no encontrada',

    REVIEW_CLASS_MATCH:
      '🔎 Clase para revisar',

    PROTECTED_EXISTING_DATE:
      '🛡️ Fecha existente protegida',
    HISTORICAL_CLASS_NOT_ENROLLED:
        '📜 Actividad histórica sin enrollment actual',

    STUDENT_WITHOUT_ENROLLMENT:
        '👤 Alumno existente sin enrollment',

    ERROR:
      '💥 Errores',
  };

  for (
    const [
      key,
      label,
    ]
    of Object.entries(
      labels,
    )
  ) {
    console.log(
      `${label}: ${
        counts[key] ?? 0
      }`,
    );
  }
}

/* =========================================================
 * CHECK DEL EXCEL
 * ========================================================= */

function checkFile(
  history,
) {
  const uniqueStudents =
    new Set(
      history.map(
        (row) =>
          normalizeName(
            row.fullName,
          ),
      ),
    );

  const uniqueActivities =
    new Set(
      history
        .map(
          (row) =>
            row.activity,
        )
        .filter(Boolean)
        .map(
          normalizeText,
        ),
    );

  const missingDates =
    history.filter(
      (row) =>
        !row.startDate,
    );

  console.log('');
  console.log(
    '📊 ANÁLISIS DEL EXCEL',
  );

  console.log(
    `👥 Alumnos: ${uniqueStudents.size}`,
  );

  console.log(
    `🔗 Relaciones alumno/actividad: ${history.length}`,
  );

  console.log(
    `💃 Actividades distintas: ${uniqueActivities.size}`,
  );

  console.log(
    `⚠️ Relaciones sin fecha válida: ${missingDates.length}`,
  );

  console.log('');
  console.log(
    '💃 Actividades encontradas:',
  );

  for (
    const activity
    of [
      ...uniqueActivities,
    ].sort()
  ) {
    console.log(
      `   - ${activity}`,
    );
  }

  if (
    missingDates.length >
    0
  ) {
    console.log('');
    console.log(
      '⚠️ Primeros casos sin fecha:',
    );

    for (
      const row
      of missingDates.slice(
        0,
        10,
      )
    ) {
      console.log(
        `   Fila ${row.excelRow}: ${row.fullName} | ${row.activity ?? '-'} | ${row.startMonth ?? '-'}`,
      );
    }
  }
}

/* =========================================================
 * MAIN
 * ========================================================= */

async function main() {
  try {
    console.log('');
    console.log(
      '📥 Leyendo historial de ControlFit...',
    );

    console.log(
      `📄 ${HISTORY_FILE}`,
    );

    const history =
      loadHistoryExcel();

    console.log(
      `✅ Relaciones encontradas: ${history.length}`,
    );

    checkFile(
      history,
    );

    /*
     * --check-file termina acá.
     */
    if (CHECK_FILE) {
      console.log('');
      console.log(
        '✅ Verificación terminada.',
      );

      console.log(
        'No se consultó ni modificó la base de datos.',
      );

      return;
    }

    console.log('');
    console.log(
      '📥 Leyendo inscripciones actuales...',
    );

    const enrollments =
      await loadEnrollments();

    console.log(
      `📚 Inscripciones: ${enrollments.length}`,
    );

    console.log('');
        console.log(
        '📥 Leyendo alumnos actuales e históricos...',
        );

        const students =
        await loadStudents();

        console.log(
        `👥 Alumnos: ${students.length}`,
        );

    if (APPLY) {
      console.log('');
      console.log(
        '🚨 MODO APPLY',
      );

      console.log(
        'Las fechas serán modificadas en la base de datos.',
      );
    } else {
      console.log('');
      console.log(
        '🔎 MODO DRY RUN',
      );

      console.log(
        'No se modificará la base de datos.',
      );
    }

    const report =
      await processHistory(
        history,
        enrollments,
        students,
      );

    await fs.mkdir(
      OUTPUT_DIR,
      {
        recursive: true,
      },
    );

    await fs.writeFile(
      REPORT_FILE,
      JSON.stringify(
        report,
        null,
        2,
      ),
      'utf8',
    );

    printSummary(
      report,
    );

    console.log('');
    console.log(
      `📄 Reporte: ${REPORT_FILE}`,
    );

    if (!APPLY) {
      console.log('');
      console.log(
        'ℹ️ Para aplicar los cambios:',
      );

      console.log(
        'node scripts/migrate-controlfit-history.mjs --apply',
      );
    }

    if (
      !REPLACE_ANY_START_DATE
    ) {
      console.log('');
      console.log(
        `🛡️ Protección activa: solo se reemplaza null o ${PLACEHOLDER_START_DATE}.`,
      );
    }
  } catch (error) {
    console.error('');
    console.error(
      '❌ Error migrando fechas:',
    );

    console.error(
      error.stack ??
        error.message,
    );

    process.exit(1);
  }
}

await main();