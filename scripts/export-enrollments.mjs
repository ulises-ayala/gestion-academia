import { loadEnvFile } from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';

loadEnvFile('.env');

const API_URL =
  process.env.API_URL ??
  'http://localhost:3001/api/v1';

const username =
  process.env.IMPORT_ADMIN_USERNAME;

const password =
  process.env.IMPORT_ADMIN_PASSWORD;

if (!username || !password) {
  console.error(
    '❌ Faltan IMPORT_ADMIN_USERNAME o IMPORT_ADMIN_PASSWORD en el .env.',
  );
  process.exit(1);
}

/* ---------------------------------------------------------
 * Request helper
 * --------------------------------------------------------- */

async function request(url, options = {}) {
  const response = await fetch(
    url,
    options,
  );

  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `${response.status} ${response.statusText}: ${body}`,
    );
  }

  return response;
}

/* ---------------------------------------------------------
 * Login
 * --------------------------------------------------------- */
console.log('API_URL:', API_URL);
async function login() {
  console.log(
    '🔐 Iniciando sesión...',
  );

  const response =
    await request(
      `${API_URL}/auth/login`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          username,
          password,
        }),
      },
    );

  const data =
    await response.json();

  const setCookie =
    response.headers.get(
      'set-cookie',
    );

  if (!setCookie) {
    throw new Error(
      'El login fue exitoso, pero no se recibió cookie de sesión.',
    );
  }

  const sessionCookie =
    setCookie.split(';')[0];

  console.log(
    '✅ Sesión iniciada.',
  );

  console.log(
    `👤 Usuario: ${data.user?.username ?? username}`,
  );

  return sessionCookie;
}

/* ---------------------------------------------------------
 * Obtener todas las inscripciones
 * --------------------------------------------------------- */

async function getAllEnrollments(
  sessionCookie,
) {
  const enrollments = [];

  let page = 1;

  const limit = 25;
  const maxPages = 1000;

  while (page <= maxPages) {
    console.log(
      `📥 Consultando inscripciones - página ${page}...`,
    );

    const url =
      new URL(
        `${API_URL}/enrollments`,
      );

    url.searchParams.set(
      'page',
      String(page),
    );

    url.searchParams.set(
      'limit',
      String(limit),
    );

    const response =
      await request(
        url,
        {
          headers: {
            Cookie:
              sessionCookie,
          },
        },
      );

    const data =
      await response.json();

    const items =
      Array.isArray(data)
        ? data
        : data.items ??
          data.data ??
          data.results ??
          [];

    console.log(
      `   ${items.length} inscripciones obtenidas.`,
    );

    if (
      items.length === 0
    ) {
      break;
    }

    enrollments.push(
      ...items,
    );

    const totalPages =
      data.totalPages ??
      data.meta?.totalPages ??
      data.pagination?.totalPages;

    if (
      totalPages &&
      page >= totalPages
    ) {
      break;
    }

    if (
      items.length < limit
    ) {
      break;
    }

    page++;
  }

  return enrollments;
}

/* ---------------------------------------------------------
 * Normalización
 * --------------------------------------------------------- */

function normalizeEnrollment(
  enrollment,
) {
  return {
    id:
      enrollment.id ??
      null,

    studentId:
      enrollment.studentId ??
      enrollment.student?.id ??
      null,

    studentName:
      enrollment.student?.fullName ??
      [
        enrollment.student?.lastName,
        enrollment.student?.firstName,
      ]
        .filter(Boolean)
        .join(' ')
        .trim() ??
      null,

    classId:
      enrollment.classId ??
      enrollment.academyClassId ??
      enrollment.class?.id ??
      enrollment.academyClass?.id ??
      null,

    className:
        enrollment.class?.name ??
        enrollment.academyClass?.name ??
        enrollment.academicClass?.name ??
        null,

    startDate:
      enrollment.startDate ??
      null,

    endDate:
      enrollment.endDate ??
      null,

    status:
      enrollment.status ??
      null,

    createdAt:
      enrollment.createdAt ??
      null,

    updatedAt:
      enrollment.updatedAt ??
      null,

    /*
     * Conservamos también el objeto original.
     * Esto es útil si tu API devuelve campos
     * con nombres distintos a los esperados.
     */
    raw:
      enrollment,
  };
}

/* ---------------------------------------------------------
 * Guardar JSON
 * --------------------------------------------------------- */

async function saveJson(
  enrollments,
) {
  const outputDir =
    path.resolve('exports');

  await fs.mkdir(
    outputDir,
    {
      recursive: true,
    },
  );

  const outputPath =
    path.join(
      outputDir,
      'enrollments-current.json',
    );

  await fs.writeFile(
    outputPath,
    JSON.stringify(
      enrollments,
      null,
      2,
    ),
    'utf8',
  );

  return outputPath;
}

/* ---------------------------------------------------------
 * Resumen
 * --------------------------------------------------------- */

function printSummary(
  enrollments,
) {
  console.log('');
  console.log(
    `📚 Inscripciones encontradas: ${enrollments.length}`,
  );

  const statusCounts =
    new Map();

  for (
    const enrollment
    of enrollments
  ) {
    const status =
      enrollment.status ??
      'SIN_ESTADO';

    statusCounts.set(
      status,
      (
        statusCounts.get(
          status,
        ) ?? 0
      ) + 1,
    );
  }

  for (
    const [
      status,
      count,
    ] of statusCounts
  ) {
    console.log(
      `   ${status}: ${count}`,
    );
  }

  const withoutStudent =
    enrollments.filter(
      (enrollment) =>
        !enrollment.studentId,
    );

  const withoutClass =
    enrollments.filter(
      (enrollment) =>
        !enrollment.classId,
    );

  if (
    withoutStudent.length > 0
  ) {
    console.log(
      `⚠️ Sin studentId: ${withoutStudent.length}`,
    );
  }

  if (
    withoutClass.length > 0
  ) {
    console.log(
      `⚠️ Sin classId: ${withoutClass.length}`,
    );
  }
}

/* ---------------------------------------------------------
 * Main
 * --------------------------------------------------------- */

async function main() {
  try {
    const sessionCookie =
      await login();

    const rawEnrollments =
      await getAllEnrollments(
        sessionCookie,
      );

    const enrollments =
      rawEnrollments.map(
        normalizeEnrollment,
      );

    printSummary(
      enrollments,
    );

    const outputPath =
      await saveJson(
        enrollments,
      );

    console.log('');
    console.log(
      '✅ Exportación finalizada.',
    );

    console.log(
      `📄 Archivo: ${outputPath}`,
    );
  } catch (error) {
    console.error('');
    console.error(
      '❌ Error exportando inscripciones:',
    );

    console.error(
      error.stack ??
      error.message,
    );

    process.exit(1);
  }
}

await main();