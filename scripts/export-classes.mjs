import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';

loadEnvFile('.env');

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

const OUTPUT_DIR = path.resolve(
  './exports',
);

const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  'classes-current.json',
);

const PAGE_SIZE = 100;

/* =========================================================
 * LOGIN
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

  return setCookie
    .split(';')[0];
}

/* =========================================================
 * FETCH
 * ========================================================= */

async function fetchClassesPage(
  page,
  sessionCookie,
) {
  const url =
    new URL(
      `${API_BASE_URL}/classes`,
    );

  url.searchParams.set(
    'page',
    String(page),
  );

  url.searchParams.set(
    'pageSize',
    String(PAGE_SIZE),
  );

  const response =
    await fetch(
      url,
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
      `Error obteniendo clases (${response.status}): ${body}`,
    );
  }

  return response.json();
}

/* =========================================================
 * NORMALIZACIÓN
 * ========================================================= */

function normalizeClass(
  item,
) {
  return {
    id:
      item.id,

    name:
      item.name,

    level:
      item.level ??
      null,

    capacity:
      item.capacity ??
      null,

    status:
      item.status ??
      null,

    danceType:
      item.danceType
        ? {
            id:
              item.danceType.id,

            name:
              item.danceType.name,
          }
        : null,

    teacher:
      item.teacher
        ? {
            id:
              item.teacher.id,

            firstName:
              item.teacher.firstName,

            lastName:
              item.teacher.lastName,

            fullName:
              [
                item.teacher.lastName,
                item.teacher.firstName,
              ]
                .filter(Boolean)
                .join(' ')
                .trim(),
          }
        : null,

    schedules:
      Array.isArray(
        item.schedules,
      )
        ? item.schedules.map(
            (schedule) => ({
              id:
                schedule.id,

              dayOfWeek:
                schedule.dayOfWeek,

              startTime:
                schedule.startTime,

              endTime:
                schedule.endTime,

              room:
                schedule.room
                  ? {
                      id:
                        schedule.room.id,

                      name:
                        schedule.room.name,

                      branch:
                        schedule.room.branch
                          ? {
                              id:
                                schedule.room.branch.id,

                              name:
                                schedule.room.branch.name,
                            }
                          : null,
                    }
                  : null,
            }),
          )
        : [],

    createdAt:
      item.createdAt ??
      null,

    updatedAt:
      item.updatedAt ??
      null,

    raw:
      item,
  };
}

/* =========================================================
 * MAIN
 * ========================================================= */

async function main() {
  try {
    console.log('');
    console.log(
      '🔐 Iniciando sesión...',
    );

    const sessionCookie =
      await login();

    console.log(
      '✅ Sesión iniciada.',
    );

    console.log('');
    console.log(
      '📥 Exportando clases...',
    );

    const allClasses =
      [];

    let page = 1;
    let total = null;

    while (true) {
      const response =
        await fetchClassesPage(
          page,
          sessionCookie,
        );

      /*
       * Soportamos dos formatos comunes:
       *
       * {
       *   items: [...],
       *   total,
       *   page,
       *   pageSize
       * }
       *
       * o directamente [...]
       */
      const items =
        Array.isArray(response)
          ? response
          : response.items ?? [];

      if (
        !Array.isArray(items)
      ) {
        throw new Error(
          'La respuesta de /classes no contiene un array de clases.',
        );
      }

      if (
        total === null &&
        !Array.isArray(response)
      ) {
        total =
          Number(
            response.total ??
            0,
          );
      }

      allClasses.push(
        ...items.map(
          normalizeClass,
        ),
      );

      console.log(
        `   Página ${page}: ${items.length} clases`,
      );

      /*
       * Si la API devolvió array directo,
       * asumimos una sola página.
       */
      if (
        Array.isArray(response)
      ) {
        break;
      }

      /*
       * Si no vino nada más,
       * terminamos.
       */
      if (
        items.length === 0
      ) {
        break;
      }

      /*
       * Si ya alcanzamos total.
       */
      if (
        total !== null &&
        allClasses.length >= total
      ) {
        break;
      }

      /*
       * Si vino menos que PAGE_SIZE,
       * también terminamos.
       */
      if (
        items.length < PAGE_SIZE
      ) {
        break;
      }

      page++;
    }

    /*
     * Evitamos duplicados por id,
     * por seguridad.
     */
    const uniqueById =
      new Map();

    for (
      const academicClass
      of allClasses
    ) {
      if (
        !academicClass.id
      ) {
        continue;
      }

      uniqueById.set(
        academicClass.id,
        academicClass,
      );
    }

    const classes =
      [
        ...uniqueById.values(),
      ].sort(
        (a, b) =>
          String(
            a.name ?? '',
          ).localeCompare(
            String(
              b.name ?? '',
            ),
            'es',
          ),
      );

    await fs.mkdir(
      OUTPUT_DIR,
      {
        recursive:
          true,
      },
    );

    await fs.writeFile(
      OUTPUT_FILE,
      JSON.stringify(
        classes,
        null,
        2,
      ),
      'utf8',
    );

    console.log('');
    console.log(
      '📊 EXPORTACIÓN COMPLETA',
    );

    console.log(
      `💃 Clases exportadas: ${classes.length}`,
    );

    console.log(
      `📄 Archivo: ${OUTPUT_FILE}`,
    );
  } catch (
    error
  ) {
    console.error('');
    console.error(
      '❌ Error exportando clases:',
    );

    console.error(
      error.stack ??
        error.message,
    );

    process.exit(1);
  }
}

await main();