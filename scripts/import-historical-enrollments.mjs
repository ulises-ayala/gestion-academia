import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';

loadEnvFile('.env');

/* =========================================================
 * CONFIG
 * ========================================================= */
const CLASSES_FILE = path.resolve(
  './exports/classes-current.json',
);
const API_BASE_URL =
  process.env.API_BASE_URL ??
  'http://localhost:3001/api/v1';

const ADMIN_USERNAME =
  process.env.IMPORT_ADMIN_USERNAME;

const ADMIN_PASSWORD =
  process.env.IMPORT_ADMIN_PASSWORD;

const MIGRATION_REPORT = path.resolve(
  './exports/migracion-historial-enrollments.json',
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

const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  'historical-enrollments-candidates.json',
);

const APPLY =
  process.argv.includes('--apply');

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

function sortedName(value) {
  return normalizeText(value)
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');
}

/* =========================================================
 * ACTIVIDAD → CLASE
 * ========================================================= */

const ACTIVITY_CLASS_MAP = {
  'ARABE INFANTIL':
    'Árabe infantil',

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

  'COREOGRAFICO E MASC BACHATA URBAN':
    'Coreografico E.Masc- Bachata/Urban',

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

  'LADYS TRAINING':
    'Clase LT - A.Frank',

  'MAMBO EN PAREJA':
    'Mambo en parejas',

  'SALSA Y BACHATA EN PAREJA FABI':
    'S&B Parejas',

  'STREET COREOGRAFICO ADULTO':
    'S.C Adultos (+18 años)',

  'STREET COREOGRAFICO AVANZADO INTERMEDIO':
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
};
const HISTORICAL_CLASS_ID_MAP = {
  /*
   * Coreográfico masculino Bachata/Urban
   *
   * Hay una clase ACTIVE y otra INACTIVE
   * cuyos nombres normalizan igual.
   *
   * Para el historial usamos la INACTIVE.
   */
  'COREOGRAFICO E MASC BACHATA URBAN':
    '2d17175b-22b0-4565-9342-1e93ad221855',

  /*
   * Coreografico_Frank
   * corresponde históricamente a
   * Grupo C. - A.Frank.
   */
  'COREOGRAFICO FRANK':
    'e63b18a1-afc2-4fd1-aa80-dfce8909e30f',

  'COREGRAFICO FRANK':
    'e63b18a1-afc2-4fd1-aa80-dfce8909e30f',
};

function resolveClassName(activity) {
  const normalized =
    normalizeText(activity);

  return (
    ACTIVITY_CLASS_MAP[
      normalized
    ] ??
    activity
  );
}

/* =========================================================
 * ARCHIVOS
 * ========================================================= */

async function readJson(file) {
  return JSON.parse(
    await fs.readFile(
      file,
      'utf8',
    ),
  );
}

/* =========================================================
 * LOGIN
 * ========================================================= */

async function login() {
  if (
    !ADMIN_USERNAME ||
    !ADMIN_PASSWORD
  ) {
    throw new Error(
      'Faltan credenciales en .env',
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
    throw new Error(
      `Login falló: ${await response.text()}`,
    );
  }

  const setCookie =
    response.headers.get(
      'set-cookie',
    );

  if (!setCookie) {
    throw new Error(
      'La API no devolvió cookie.',
    );
  }

  return setCookie
    .split(';')[0];
}

/* =========================================================
 * CREACIÓN
 * ========================================================= */

async function createHistoricalEnrollment(
  candidate,
  sessionCookie,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/enrollments/historical`,
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
          JSON.stringify({
            studentId:
              candidate.studentId,

            classId:
              candidate.classId,

            startDate:
              candidate.startDate,

            endDate:
              candidate.endDate,
          }),
      },
    );

  if (!response.ok) {
    throw new Error(
      `${response.status}: ${await response.text()}`,
    );
  }

  return response.json();
}

/* =========================================================
 * MAIN
 * ========================================================= */

async function main() {
  const migrationReport =
    await readJson(
      MIGRATION_REPORT,
    );
    const classes =
    await readJson(
        CLASSES_FILE,
    );
  const enrollments =
    await readJson(
      ENROLLMENTS_FILE,
    );

  const students =
    await readJson(
      STUDENTS_FILE,
    );

  /*
   * Solo tomamos las relaciones históricas
   * que sabemos que necesitan enrollment.
   */
  const pending =
    migrationReport.filter(
      (row) =>
        row.result ===
          'HISTORICAL_CLASS_NOT_ENROLLED' ||
        row.result ===
          'STUDENT_WITHOUT_ENROLLMENT',
    );

  console.log('');
  console.log(
    `📜 Relaciones históricas pendientes: ${pending.length}`,
  );

  /*
   * Catálogo de clases obtenido de los
   * enrollments exportados.
   */
const classesById =
  new Map();

const classesByName =
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

  classesById.set(
    academicClass.id,
    academicClass,
  );

  const key =
    normalizeText(
      academicClass.name,
    );

  if (
    !classesByName.has(key)
  ) {
    classesByName.set(
      key,
      [],
    );
  }

  classesByName
    .get(key)
    .push(
      academicClass,
    );
}

  const candidates = [];

  for (
    const row
    of pending
  ) {
    /*
     * Student.
     */
    let studentId =
      row.studentId ??
      null;

    if (!studentId) {
      const key =
        sortedName(
          row.fullName,
        );

      const student =
        students.find(
          (candidate) =>
            sortedName(
              candidate.fullName,
            ) === key,
        );

      studentId =
        student?.id ??
        null;
    }

    /*
     * Class.
     */
    const desiredClassName =
        row.mappedClass ??
        resolveClassName(
            row.activity,
        );

        const classMatch =
        findHistoricalClass(
            row.activity,
            desiredClassName,
            classesById,
            classesByName,
        );

        const academicClass =
        classMatch.academicClass;

    const candidate = {
      fullName:
        row.fullName,

      activity:
        row.activity,

      studentId,

      classId:
        academicClass?.id ??
        null,

      className:
        academicClass?.name ??
        desiredClassName,
      classMatchType:
        classMatch.matchType,
      startDate:
        row.startDate,
      classStatus:
        academicClass?.status ??
        null,

      /*
       * IMPORTANTE:
       * todavía no inventamos endDate.
       */
      endDate:
        null,

      sourceResult:
        row.result,
    };

    if (!studentId) {
      candidate.result =
        'MISSING_STUDENT';
    } else if (
      !academicClass
    ) {
      candidate.result =
        'MISSING_CLASS';
    } else if (
      !row.startDate
    ) {
      candidate.result =
        'MISSING_START_DATE';
    } else {
      candidate.result =
        'READY';
    }

    candidates.push(
      candidate,
    );
  }

  await fs.mkdir(
    OUTPUT_DIR,
    {
      recursive: true,
    },
  );

function findHistoricalClass(
  activity,
  desiredClassName,
  classesById,
  classesByName,
) {
  const normalizedActivity =
    normalizeText(
      activity,
    );

  /*
   * 1. ID histórico explícito.
   *
   * Tiene prioridad absoluta.
   */
  const historicalClassId =
    HISTORICAL_CLASS_ID_MAP[
      normalizedActivity
    ];

  if (
    historicalClassId
  ) {
    const academicClass =
      classesById.get(
        historicalClassId,
      );

    if (
      academicClass
    ) {
      return {
        academicClass,
        matchType:
          'HISTORICAL_CLASS_ID',
      };
    }
  }

  /*
   * 2. Buscar por nombre.
   */
  const normalizedClassName =
    normalizeText(
      desiredClassName,
    );

  const candidates =
    classesByName.get(
      normalizedClassName,
    ) ?? [];

  if (
    candidates.length === 0
  ) {
    return {
      academicClass:
        null,

      matchType:
        'NO_CLASS',
    };
  }

  /*
   * Solo hay una opción.
   */
  if (
    candidates.length === 1
  ) {
    return {
      academicClass:
        candidates[0],

      matchType:
        'EXACT_CLASS_NAME',
    };
  }

  /*
   * Si hay varias clases con el mismo
   * nombre normalizado, para un historial
   * preferimos una INACTIVE.
   *
   * Los casos realmente delicados ya
   * deberían estar en HISTORICAL_CLASS_ID_MAP.
   */
  const inactive =
    candidates.find(
      (candidate) =>
        candidate.status ===
        'INACTIVE',
    );

  if (
    inactive
  ) {
    return {
      academicClass:
        inactive,

      matchType:
        'DUPLICATE_NAME_INACTIVE',
    };
  }

  return {
    academicClass:
      null,

    matchType:
      'AMBIGUOUS_CLASS',
  };
}
  /*
   * Por ahora el --apply queda bloqueado
   * para registros sin endDate.
   */
  if (APPLY) {
    const ready =
      candidates.filter(
        (candidate) =>
          candidate.result ===
          'READY',
      );

    console.log('');
    console.log(
      `✅ Listos para crear: ${ready.length}`,
    );

    if (
      ready.length === 0
    ) {
      console.log(
        '⚠️ No hay enrollments con endDate confirmado.',
      );
    }

    if (
      ready.length > 0
    ) {
      const cookie =
        await login();

      for (
        const candidate
        of ready
      ) {
        try {
          const created =
            await createHistoricalEnrollment(
              candidate,
              cookie,
            );

          candidate.result =
            'CREATED';

          candidate.enrollmentId =
            created.id;
        } catch (error) {
          candidate.result =
            'ERROR';

          candidate.error =
            error.message;
        }
      }
    }
  }

  await fs.writeFile(
    OUTPUT_FILE,

    JSON.stringify(
      candidates,
      null,
      2,
    ),

    'utf8',
  );

  const counts =
    candidates.reduce(
      (acc, candidate) => {
        acc[candidate.result] =
          (
            acc[
              candidate.result
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
    `✅ Listos para crear: ${
      counts.READY ??
      0
    }`,
  );

  console.log(
    `❌ Alumno faltante: ${
      counts.MISSING_STUDENT ??
      0
    }`,
  );

  console.log(
    `❌ Clase faltante: ${
      counts.MISSING_CLASS ??
      0
    }`,
  );

  console.log(
    `⚠️ Falta startDate: ${
      counts.MISSING_START_DATE ??
      0
    }`,
  );

  console.log(
    `✅ Creados: ${
      counts.CREATED ??
      0
    }`,
  );

  console.log(
    `💥 Errores: ${
      counts.ERROR ??
      0
    }`,
  );

  console.log('');
  console.log(
    `📄 ${OUTPUT_FILE}`,
  );
}

await main();