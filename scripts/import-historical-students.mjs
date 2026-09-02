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

const HISTORY_FILE = path.resolve(
  './scripts/data/Historial_Para_Mariano_CORREGIDO_ACTIVOS.xlsx',
);

const STUDENTS_FILE = path.resolve(
  './exports/students-current.json',
);

const OUTPUT_DIR = path.resolve(
  './exports',
);

const REPORT_FILE = path.join(
  OUTPUT_DIR,
  'import-historical-students-report.json',
);

/*
 * Por defecto es dry-run.
 *
 * Solo --apply escribe.
 */
const APPLY =
  process.argv.includes('--apply');

/*
 * DNI técnico reservado para históricos sin DNI.
 *
 * Vamos generando:
 * 900000001
 * 900000002
 * ...
 */
const TEMP_DNI_START = 900000001;

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

function normalizeDni(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .trim();
}

/* =========================================================
 * DETECCIÓN DE COLUMNAS
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

/* =========================================================
 * NOMBRE
 * ========================================================= */

/*
 * El Excel viene como:
 *
 * APELLIDO NOMBRE
 *
 * Igual que students-current.json:
 *
 * fullName = lastName + firstName
 *
 * Como no tenemos una columna separada para apellido/nombre,
 * usamos la misma convención que el importador original:
 *
 * primera palabra = apellido
 * resto = nombres
 *
 * Para apellidos compuestos agregamos excepciones abajo.
 */

const COMPOUND_LAST_NAME_MAP = {
    'GERARDO OBREGON': {
  lastName: 'OBREGON',
  firstName: 'GERARDO',
},

'GISSELLA MIQUEL': {
  lastName: 'MIQUEL',
  firstName: 'GISSELLA',
},

'YANINA ORTIZ': {
  lastName: 'ORTIZ',
  firstName: 'YANINA',
},
  'CACERES FERNANDEZ AGOSTINA': {
    lastName: 'CACERES FERNANDEZ',
    firstName: 'AGOSTINA',
  },

  'D AUGERO CLAUDIA BEATRIZ': {
    lastName: 'D AUGERO',
    firstName: 'CLAUDIA BEATRIZ',
  },

  'DE LOS SANTOS MELISA': {
    lastName: 'DE LOS SANTOS',
    firstName: 'MELISA',
  },

  'DE MICHIELIS AZUL': {
    lastName: 'DE MICHIELIS',
    firstName: 'AZUL',
  },

  'DEL VALLE AITANA NICOL': {
    lastName: 'DEL VALLE',
    firstName: 'AITANA NICOL',
  },

  'FERNANDEZ LETICIA AILEN': {
    lastName: 'FERNANDEZ',
    firstName: 'LETICIA AILEN',
  },

  'GOMEZ FEDERICO ADRIAN': {
    lastName: 'GOMEZ',
    firstName: 'FEDERICO ADRIAN',
  },

  'LAGRANA EUGENIA ROSELY': {
    lastName: 'LAGRAÑA',
    firstName: 'EUGENIA ROSELY',
  },

  'LO CURCIO MARTINA': {
    lastName: 'LO CURCIO',
    firstName: 'MARTINA',
  },

  'MEDINA PATINO YANI': {
    lastName: 'MEDINA PATIÑO',
    firstName: 'YANI',
  },

  'RIVAS KARLA AGOSTINA': {
    lastName: 'RIVAS',
    firstName: 'KARLA AGOSTINA',
  },

  'RUIZ DIAZ FLORENCIA': {
    lastName: 'RUIZ DIAZ',
    firstName: 'FLORENCIA',
  },
};

function splitFullName(
  fullName,
) {
  const normalized =
    normalizeName(
      fullName,
    );

  const mapped =
    COMPOUND_LAST_NAME_MAP[
      normalized
    ];

  if (mapped) {
    return mapped;
  }

  const parts =
    String(fullName)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length === 1
  ) {
    return {
      lastName:
        parts[0],

      firstName:
        'SIN NOMBRE',
    };
  }

  return {
    lastName:
      parts[0],

    firstName:
      parts
        .slice(1)
        .join(' '),
  };
}

/* =========================================================
 * LECTURA DEL HISTORIAL
 * ========================================================= */

function loadHistoricalStudents() {
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
      'El Excel histórico no contiene hojas.',
    );
  }

  const sheet =
    workbook.Sheets[
      workbook.SheetNames[0]
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
      'El Excel histórico está vacío.',
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

  if (
    !studentColumn
  ) {
    throw new Error(
      'No pude identificar la columna Alumno.',
    );
  }

  /*
   * Consolidamos alumno único.
   */
  const studentsMap =
    new Map();

  for (
    let index = 0;
    index <
    rows.length;
    index++
  ) {
    const row =
      rows[index];

    const fullName =
      String(
        row[
          studentColumn
        ] ?? '',
      )
        .trim()
        .replace(
          /\s+/g,
          ' ',
        );

    if (
      !fullName
    ) {
      continue;
    }

    const key =
      sortedName(
        fullName,
      );

    if (
      studentsMap.has(
        key,
      )
    ) {
      studentsMap
        .get(key)
        .excelRows
        .push(
          index + 2,
        );

      continue;
    }

    studentsMap.set(
      key,
      {
        fullName,

        normalizedName:
          normalizeName(
            fullName,
          ),

        sortedName:
          key,

        excelRows: [
          index + 2,
        ],
      },
    );
  }

  return [
    ...studentsMap.values(),
  ];
}

/* =========================================================
 * LECTURA DE ALUMNOS ACTUALES
 * ========================================================= */

async function loadCurrentStudents() {
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

/* =========================================================
 * MATCH
 * ========================================================= */

function findExistingStudent(
  historicalStudent,
  currentStudents,
) {
  /*
   * Nombre exacto.
   */
  const exact =
    currentStudents.find(
      (student) =>
        normalizeName(
          student.fullName,
        ) ===
        historicalStudent
          .normalizedName,
    );

  if (exact) {
    return {
      type:
        'EXACT_NAME',

      student:
        exact,
    };
  }

  /*
   * Nombre reordenado.
   */
  const reordered =
    currentStudents.find(
      (student) =>
        sortedName(
          student.fullName,
        ) ===
        historicalStudent
          .sortedName,
    );

  if (reordered) {
    return {
      type:
        'EXACT_REORDERED',

      student:
        reordered,
    };
  }

  return {
    type:
      'NOT_FOUND',

    student:
      null,
  };
}

/* =========================================================
 * DNI TÉCNICO
 * ========================================================= */

function buildUsedDnis(
  currentStudents,
) {
  return new Set(
    currentStudents
      .map(
        (student) =>
          normalizeDni(
            student.dni,
          ),
      )
      .filter(Boolean),
  );
}

function createTemporaryDniGenerator(
  currentStudents,
) {
  const used =
    buildUsedDnis(
      currentStudents,
    );

  let next =
    TEMP_DNI_START;

  return function generate() {
    while (
      used.has(
        String(next),
      )
    ) {
      next++;
    }

    const value =
      String(next);

    used.add(
      value,
    );

    next++;

    return value;
  };
}

/* =========================================================
 * AUTENTICACIÓN
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

  if (
    !response.ok
  ) {
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

  if (
    !setCookie
  ) {
    throw new Error(
      'La API no devolvió cookie de sesión.',
    );
  }

  return setCookie
    .split(';')[0];
}

/* =========================================================
 * POST STUDENT
 * ========================================================= */

async function createStudent(
  payload,
  sessionCookie,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/students`,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json',

          Cookie:
            sessionCookie,
        },

        body:
          JSON.stringify(
            payload,
          ),
      },
    );

  if (
    !response.ok
  ) {
    const body =
      await response.text();

    throw new Error(
      `${response.status}: ${body}`,
    );
  }

  return response.json();
}
/* =========================================================
 * DESACTIVACION DE ESTUDAINTE
 * ========================================================= */

async function deactivateStudent(
  studentId,
  sessionCookie,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/students/${studentId}`,
      {
        method:
          'DELETE',

        headers: {
          Cookie:
            sessionCookie,
        },
      },
    );

  if (
    !response.ok
  ) {
    const body =
      await response.text();

    throw new Error(
      `No se pudo desactivar el alumno (${response.status}): ${body}`,
    );
  }

  return response.json();
}
/* =========================================================
 * PROCESAMIENTO
 * ========================================================= */

async function processStudents(
  historicalStudents,
  currentStudents,
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

  const generateDni =
    createTemporaryDniGenerator(
      currentStudents,
    );

  const report =
    [];

  for (
    const historicalStudent
    of historicalStudents
  ) {
    const match =
      findExistingStudent(
        historicalStudent,
        currentStudents,
      );

    /*
     * Ya existe.
     */
    if (
      match.student
    ) {
      report.push({
        ...historicalStudent,

        result:
          'ALREADY_EXISTS',

        matchType:
          match.type,

        studentId:
          match.student.id,

        studentDni:
          match.student.dni,

        currentFullName:
          match.student.fullName,
      });

      continue;
    }

    /*
     * No existe.
     */
    const {
      firstName,
      lastName,
    } =
      splitFullName(
        historicalStudent
          .fullName,
      );

    const temporaryDni =
      generateDni();

    const payload = {
      dni:
        temporaryDni,

      firstName,

      lastName,

      birthDate:
        null,

      phone:
        null,

      email:
        null,

      address:
        null,
    };

    /*
     * DRY RUN.
     */
    if (
      !APPLY
    ) {
      report.push({
        ...historicalStudent,

        payload,

        result:
          'WOULD_CREATE',
      });

      continue;
    }

    /*
     * APPLY.
     */
    let created = null;

try {
  /*
   * 1. Crear alumno.
   */
  created =
    await createStudent(
      payload,
      sessionCookie,
    );

  const createdStudentId =
    created.id;

  if (
    !createdStudentId
  ) {
    throw new Error(
      'La API creó el alumno pero no devolvió su id.',
    );
  }

  /*
   * 2. Desactivarlo.
   */
  const deactivated =
    await deactivateStudent(
      createdStudentId,
      sessionCookie,
    );

  report.push({
    ...historicalStudent,

    payload,

    result:
      'CREATED_INACTIVE',

    createdStudentId,

    finalStatus:
      deactivated.status ??
      'INACTIVE',
  });

  currentStudents.push({
    id:
      createdStudentId,

    dni:
      temporaryDni,

    firstName,

    lastName,

    fullName: [
      lastName,
      firstName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim(),

    status:
      'INACTIVE',
  });
} catch (
  error
) {
  report.push({
    ...historicalStudent,

    payload,

    result:
      created?.id
        ? 'CREATED_BUT_DEACTIVATION_FAILED'
        : 'ERROR',

    createdStudentId:
      created?.id ??
      null,

    error:
      error.message,
  });
    }

    
} return report;}
/* =========================================================
 * RESUMEN
 * ========================================================= */

function printSummary(
  report,
) {
  const counts =
    report.reduce(
      (
        acc,
        row,
      ) => {
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
    '📊 RESULTADO',
  );

  console.log(
    `👤 Ya existían: ${
      counts
        .ALREADY_EXISTS ??
      0
    }`,
  );

  console.log(
    `🟡 Se crearían: ${
      counts
        .WOULD_CREATE ??
      0
    }`,
  );

  console.log(
  `✅ Creados como INACTIVE: ${
    counts
      .CREATED_INACTIVE ??
    0
  }`,
);
console.log(
  `⚠️ Creados pero no desactivados: ${
    counts
      .CREATED_BUT_DEACTIVATION_FAILED ??
    0
  }`,
);

  console.log(
    `💥 Errores: ${
      counts
        .ERROR ??
      0
    }`,
  );
}

/* =========================================================
 * MAIN
 * ========================================================= */

async function main() {
  try {
    console.log('');
    console.log(
      '📥 Leyendo historial...',
    );

    console.log(
      `📄 ${HISTORY_FILE}`,
    );

    const historicalStudents =
      loadHistoricalStudents();

    console.log(
      `👥 Alumnos únicos del historial: ${historicalStudents.length}`,
    );

    console.log('');
    console.log(
      '📥 Leyendo alumnos actuales...',
    );

    const currentStudents =
      await loadCurrentStudents();

    console.log(
      `👥 Alumnos actuales: ${currentStudents.length}`,
    );

    if (
      APPLY
    ) {
      console.log('');
      console.log(
        '🚨 MODO APPLY',
      );

      console.log(
        'Se crearán alumnos históricos faltantes.',
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
      await processStudents(
        historicalStudents,
        currentStudents,
      );

    await fs.mkdir(
      OUTPUT_DIR,
      {
        recursive:
          true,
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

    if (
      !APPLY
    ) {
      console.log('');
      console.log(
        'ℹ️ Para aplicar:',
      );

      console.log(
        'node --env-file=.env ./scripts/import-historical-students.mjs --apply',
      );
    }
  } catch (
    error
  ) {
    console.error('');
    console.error(
      '❌ Error importando alumnos históricos:',
    );

    console.error(
      error.stack ??
      error.message,
    );

    process.exit(1);
  }
}

await main();