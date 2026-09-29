import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import xlsx from 'xlsx';

loadEnvFile('.env');

const { utils, writeFile } = xlsx;

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

const ENROLLMENTS_FILE = path.resolve(
  './exports/enrollments-current.json',
);

const OUTPUT_DIR = path.resolve(
  './exports',
);

const OUTPUT_JSON = path.join(
  OUTPUT_DIR,
  'historical-monthly-charges-analysis.json',
);

const OUTPUT_XLSX = path.join(
  OUTPUT_DIR,
  'historical-monthly-charges-analysis.xlsx',
);

/*
 * Fecha máxima que queremos analizar.
 * Así evitamos proyectar cuotas al futuro.
 */

const HISTORICAL_CUTOFF =
  '2026-08-31';


const TODAY =
  new Date()
    .toISOString()
    .slice(0, 10);

const CURRENT_MONTH =
  TODAY.slice(0, 7);

/*
 * Las cuotas vencen el día 10.
 */
const DUE_DAY = 10;

/* =========================================================
 * HELPERS DE FECHA
 * ========================================================= */

function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      `${String(value).slice(0, 10)}T00:00:00.000Z`,
    );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function isoDate(date) {
  return date
    .toISOString()
    .slice(0, 10);
}

function monthKey(value) {
  return String(value)
    .slice(0, 7);
}

function firstDayOfMonth(value) {
  const date =
    parseIsoDate(value);

  if (!date) {
    return null;
  }

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1,
    ),
  );
}

function lastDayOfMonth(value) {
  const date =
    parseIsoDate(value);

  if (!date) {
    return null;
  }

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      0,
    ),
  );
}

function nextMonth(date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      1,
    ),
  );
}

function maxDate(...values) {
  const valid =
    values.filter(Boolean);

  if (valid.length === 0) {
    return null;
  }

  return new Date(
    Math.max(
      ...valid.map(
        (date) =>
          date.getTime(),
      ),
    ),
  );
}

function minDate(...values) {
  const valid =
    values.filter(Boolean);

  if (valid.length === 0) {
    return null;
  }

  return new Date(
    Math.min(
      ...valid.map(
        (date) =>
          date.getTime(),
      ),
    ),
  );
}

function dueDateForPeriod(period) {
  return `${period}-${String(DUE_DAY).padStart(2, '0')}`;
}

/* =========================================================
 * HELPERS GENERALES
 * ========================================================= */

function normalizeAmount(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number.toFixed(2);
}

function studentName(enrollment) {
  const first =
    enrollment.student?.firstName ?? '';

  const last =
    enrollment.student?.lastName ?? '';

  return `${last} ${first}`
    .trim();
}

function className(enrollment) {
  return (
    enrollment.academicClass?.name ??
    enrollment.className ??
    ''
  );
}

/* =========================================================
 * LECTURA DE ENROLLMENTS
 * ========================================================= */

async function readEnrollments() {
  const raw =
    await fs.readFile(
      ENROLLMENTS_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(raw);

  /*
   * Aceptamos varias estructuras para que el script
   * sea tolerante a cómo se exportó el archivo.
   */
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed.items)) {
    return parsed.items;
  }

  if (Array.isArray(parsed.enrollments)) {
    return parsed.enrollments;
  }

  throw new Error(
    'No pude encontrar el array de enrollments en enrollments-current.json',
  );
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

/* =========================================================
 * TARIFAS
 * ========================================================= */

function indexTariffsByClass(tariffs) {
  const byClass =
    new Map();

  for (const tariff of tariffs) {
    if (!tariff.classId) {
      continue;
    }

    if (!byClass.has(tariff.classId)) {
      byClass.set(
        tariff.classId,
        [],
      );
    }

    byClass
      .get(tariff.classId)
      .push({
        ...tariff,

        amount:
          normalizeAmount(
            tariff.amount,
          ),

        validFromDate:
          parseIsoDate(
            tariff.validFrom,
          ),

        validToDate:
          tariff.validTo
            ? parseIsoDate(
                tariff.validTo,
              )
            : null,
      });
  }

  for (
    const items
    of byClass.values()
  ) {
    items.sort(
      (a, b) =>
        a.validFrom.localeCompare(
          b.validFrom,
        ),
    );
  }

  return byClass;
}

/* =========================================================
 * CUOTAS EXISTENTES
 * ========================================================= */

async function fetchExistingCharges(
  sessionCookie,
) {
  try {
    const response =
      await apiJson(
        '/monthly-charges',
        sessionCookie,
      );

    if (
      response &&
      Array.isArray(
        response.items,
      )
    ) {
      return response.items;
    }

    if (Array.isArray(response)) {
      return response;
    }

    return [];
  } catch (error) {
    /*
     * El análisis puede seguir aunque este endpoint
     * no exista o tenga otra ruta.
     */
    console.warn(
      '⚠️ No se pudieron consultar MonthlyCharge existentes.',
    );

    console.warn(
      error instanceof Error
        ? error.message
        : String(error),
    );

    return [];
  }
}

function existingChargeKey(
  enrollmentId,
  period,
) {
  return `${enrollmentId}|${period}`;
}

/* =========================================================
 * CLASIFICACIÓN
 * ========================================================= */

function classifyCandidate({
  enrollment,
  period,
  existingCharge,
}) {
  if (existingCharge) {
    return {
      result:
        'ALREADY_EXISTS',

      reason:
        'Ya existe una MonthlyCharge para esta inscripción y período.',
    };
  }

  if (
    enrollment.status ===
      'ENDED' &&
    !enrollment.endDate
  ) {
    return {
      result:
        'REVIEW_END_DATE',

      reason:
        'La inscripción está finalizada pero no tiene endDate confiable.',
    };
  }

  return {
    result:
      'SAFE',

    reason:
      enrollment.status ===
      'ACTIVE'
        ? 'Inscripción activa y período dentro de la vigencia de la tarifa.'
        : 'Inscripción finalizada con endDate conocido y período dentro de su vigencia.',
  };
}

function diagnoseNoTariffOverlap(
  enrollment,
  tariffs,
) {
  if (
    !tariffs ||
    tariffs.length === 0
  ) {
    return null;
  }

  const validTariffs =
    tariffs.filter(
      (tariff) =>
        tariff.validFrom,
    );

  if (
    validTariffs.length === 0
  ) {
    return {
      overlapType:
        'INVALID_TARIFF_DATES',

      firstTariffFrom:
        null,

      lastTariffTo:
        null,

      tariffCount:
        tariffs.length,

      reason:
        'La clase tiene tarifas, pero ninguna posee una fecha validFrom válida.',
    };
  }

  const sorted =
    [...validTariffs].sort(
      (a, b) =>
        a.validFrom.localeCompare(
          b.validFrom,
        ),
    );

  const firstTariff =
    sorted[0];

  const firstTariffFrom =
    firstTariff.validFrom;

  const tariffEnds =
    sorted.map(
      (tariff) =>
        tariff.validTo ??
        TODAY,
    );

  const lastTariffTo =
    [...tariffEnds]
      .sort(
        (a, b) =>
          b.localeCompare(a),
      )[0];

  const enrollmentStart =
    enrollment.startDate;

  const enrollmentEnd =
    enrollment.endDate ??
    TODAY;

  /*
   * 1. Fuera del alcance histórico.
   *
   * IMPORTANTE:
   * esta condición tiene que ir ANTES
   * de AFTER_LAST_TARIFF.
   */
  if (
    enrollmentStart >
    HISTORICAL_CUTOFF
  ) {
    return {
      overlapType:
        'OUTSIDE_HISTORICAL_SCOPE',

      firstTariffFrom,

      lastTariffTo,

      tariffCount:
        sorted.length,

      reason:
        `La inscripción comienza después del período histórico migrado (${HISTORICAL_CUTOFF}).`,
    };
  }

  /*
   * 2. Inscripción anterior a todas las tarifas.
   */
  if (
    enrollmentEnd <
    firstTariffFrom
  ) {
    return {
      overlapType:
        'BEFORE_FIRST_TARIFF',

      firstTariffFrom,

      lastTariffTo,

      tariffCount:
        sorted.length,

      reason:
        `La inscripción termina antes de la primera tarifa conocida (${firstTariffFrom}).`,
    };
  }

  /*
   * 3. Inscripción posterior a la última tarifa,
   * pero todavía dentro del alcance histórico.
   */
  if (
    enrollmentStart >
    lastTariffTo
  ) {
    return {
      overlapType:
        'AFTER_LAST_TARIFF',

      firstTariffFrom,

      lastTariffTo,

      tariffCount:
        sorted.length,

      reason:
        `La inscripción comienza después de la última tarifa conocida (${lastTariffTo}).`,
    };
  }

  /*
   * 4. Hueco interno.
   */
  return {
    overlapType:
      'BETWEEN_TARIFF_PERIODS',

    firstTariffFrom,

    lastTariffTo,

    tariffCount:
      sorted.length,

    reason:
      'La inscripción cae dentro del rango general de tarifas de la clase, pero en un período sin tarifa aplicable.',
  };
}

/* =========================================================
 * GENERACIÓN DE CANDIDATOS
 * ========================================================= */

function buildCandidates({
  enrollments,
  tariffsByClass,
  existingChargesByKey,
}) {
  const candidates = [];
  const enrollmentReview = [];

  for (
    const enrollment
    of enrollments
  ) {
    const tariffs =
      tariffsByClass.get(
        enrollment.classId,
      ) ?? [];

    const startDate =
      parseIsoDate(
        enrollment.startDate,
      );

    const endDate =
      enrollment.endDate
        ? parseIsoDate(
            enrollment.endDate,
          )
        : null;

    if (!startDate) {
      enrollmentReview.push({
        enrollmentId:
          enrollment.id,

        studentId:
          enrollment.studentId,

        studentName:
          studentName(
            enrollment,
          ),

        classId:
          enrollment.classId,

        className:
          className(
            enrollment,
          ),

        startDate:
          enrollment.startDate ??
          null,

        endDate:
          enrollment.endDate ??
          null,

        status:
          enrollment.status,

        result:
          'INVALID_START_DATE',

        reason:
          'La inscripción no tiene una fecha de inicio válida.',
      });

      continue;
    }

    if (tariffs.length === 0) {
      enrollmentReview.push({
        enrollmentId:
          enrollment.id,

        studentId:
          enrollment.studentId,

        studentName:
          studentName(
            enrollment,
          ),

        classId:
          enrollment.classId,

        className:
          className(
            enrollment,
          ),

        startDate:
          enrollment.startDate,

        endDate:
          enrollment.endDate ??
          null,

        status:
          enrollment.status,

        result:
          'NO_TARIFF_FOR_CLASS',

        reason:
          'No existen tarifas históricas para esta clase.',
      });

      continue;
    }

    let candidateCount = 0;

    for (
      const tariff
      of tariffs
    ) {
      if (
        !tariff.validFromDate
      ) {
        continue;
      }

      /*
       * Inicio real del tramo:
       * el mayor entre inicio de enrollment
       * e inicio de tarifa.
       */
      const overlapStart =
        maxDate(
          firstDayOfMonth(
            enrollment.startDate,
          ),
          firstDayOfMonth(
            tariff.validFrom,
          ),
        );

      /*
       * Fin del tramo:
       * - fin de tarifa
       * - endDate si existe
       * - hoy, para no proyectar futuro
       */
      const tariffEnd =
        tariff.validTo
          ? lastDayOfMonth(
              tariff.validTo,
            )
          : lastDayOfMonth(
              TODAY,
            );

      const enrollmentEnd =
        endDate
          ? lastDayOfMonth(
              enrollment.endDate,
            )
          : null;

      const analysisEnd =
        lastDayOfMonth(
          TODAY,
        );

      const overlapEnd =
        minDate(
          tariffEnd,
          enrollmentEnd,
          analysisEnd,
        );

      /*
       * Caso ENDED sin endDate:
       *
       * No sabemos hasta cuándo cobrar.
       * Igual generamos candidatos desde startDate
       * hasta el final de las tarifas conocidas,
       * pero todos quedan REVIEW_END_DATE.
       */
      const effectiveEnd =
        enrollment.status ===
          'ENDED' &&
        !endDate
          ? minDate(
              tariffEnd,
              analysisEnd,
            )
          : overlapEnd;

      if (
        !overlapStart ||
        !effectiveEnd ||
        overlapStart >
          effectiveEnd
      ) {
        continue;
      }

      let cursor =
        new Date(
          overlapStart,
        );

      while (
        cursor <=
        effectiveEnd
      ) {
        const period =
          isoDate(
            cursor,
          ).slice(
            0,
            7,
          );

        if (
          period >
          CURRENT_MONTH
        ) {
          break;
        }

        const existingCharge =
          existingChargesByKey.get(
            existingChargeKey(
              enrollment.id,
              period,
            ),
          );

        const classification =
          classifyCandidate({
            enrollment,
            period,
            existingCharge,
          });

        candidates.push({
          studentId:
            enrollment.studentId,

          studentDni:
            enrollment.student
              ?.dni ?? null,

          studentName:
            studentName(
              enrollment,
            ),

          enrollmentId:
            enrollment.id,

          enrollmentStatus:
            enrollment.status,

          enrollmentStartDate:
            enrollment.startDate,

          enrollmentEndDate:
            enrollment.endDate ??
            null,

          classId:
            enrollment.classId,

          className:
            className(
              enrollment,
            ),

          period,

          dueDate:
            dueDateForPeriod(
              period,
            ),

          tariffId:
            tariff.id,

          tariffName:
            tariff.name,

          tariffStatus:
            tariff.status,

          tariffValidFrom:
            tariff.validFrom,

          tariffValidTo:
            tariff.validTo,

          baseAmount:
            tariff.amount,

          discountAmount:
            '0.00',

          finalAmount:
            tariff.amount,

          existingChargeId:
            existingCharge?.id ??
            null,

          result:
            classification.result,

          reason:
            classification.reason,
        });

        candidateCount++;

        cursor =
          nextMonth(
            cursor,
          );
      }
    }

    if (
        candidateCount === 0
        ) {
        const diagnosis =
            diagnoseNoTariffOverlap(
            enrollment,
            tariffs,
            );

        enrollmentReview.push({
            enrollmentId:
            enrollment.id,

            studentId:
            enrollment.studentId,

            studentName:
            studentName(
                enrollment,
            ),

            classId:
            enrollment.classId,

            className:
            className(
                enrollment,
            ),

            startDate:
            enrollment.startDate,

            endDate:
            enrollment.endDate ??
            null,

            status:
            enrollment.status,

            result:
            'NO_OVERLAPPING_TARIFF',

            overlapType:
            diagnosis?.overlapType ??
            'UNKNOWN',

            firstTariffFrom:
            diagnosis?.firstTariffFrom ??
            null,

            lastTariffTo:
            diagnosis?.lastTariffTo ??
            null,

            tariffCount:
            diagnosis?.tariffCount ??
            tariffs.length,

            reason:
            diagnosis?.reason ??
            'La inscripción no se superpone con ninguna vigencia tarifaria conocida.',
        });
    }
  }

  return {
    candidates,
    enrollmentReview,
  };
}

/* =========================================================
 * VALIDACIONES ADICIONALES
 * ========================================================= */

function findCandidateDuplicates(
  candidates,
) {
  const seen =
    new Map();

  const duplicates = [];

  for (
    const candidate
    of candidates
  ) {
    const key =
      `${candidate.enrollmentId}|${candidate.period}`;

    if (
      seen.has(key)
    ) {
      duplicates.push({
        key,

        first:
          seen.get(key),

        duplicate:
          candidate,
      });

      continue;
    }

    seen.set(
      key,
      candidate,
    );
  }

  return duplicates;
}

function groupCount(items, keySelector) {
  const counts = new Map();

  for (const item of items) {
    const key = keySelector(item);

    counts.set(
      key,
      (counts.get(key) ?? 0) + 1,
    );
  }

  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      count,
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        String(a.key).localeCompare(
          String(b.key),
        ),
    );
}

function buildReviewEndDateSummary(candidates) {
  const reviewItems =
    candidates.filter(
      (item) =>
        item.result ===
        'REVIEW_END_DATE',
    );

  const byEnrollment =
    new Map();

  for (const item of reviewItems) {
    if (
      !byEnrollment.has(
        item.enrollmentId,
      )
    ) {
      byEnrollment.set(
        item.enrollmentId,
        {
          enrollmentId:
            item.enrollmentId,

          studentId:
            item.studentId,

          studentDni:
            item.studentDni,

          studentName:
            item.studentName,

          classId:
            item.classId,

          className:
            item.className,

          enrollmentStartDate:
            item.enrollmentStartDate,

          enrollmentEndDate:
            item.enrollmentEndDate,

          enrollmentStatus:
            item.enrollmentStatus,

          periods: [],
        },
      );
    }

    byEnrollment
      .get(item.enrollmentId)
      .periods.push(
        item.period,
      );
  }

  const rows =
    [...byEnrollment.values()]
      .map((item) => {
        const periods =
          [...item.periods].sort();

        return {
          enrollmentId:
            item.enrollmentId,

          studentId:
            item.studentId,

          studentDni:
            item.studentDni,

          studentName:
            item.studentName,

          classId:
            item.classId,

          className:
            item.className,

          enrollmentStartDate:
            item.enrollmentStartDate,

          enrollmentEndDate:
            item.enrollmentEndDate,

          enrollmentStatus:
            item.enrollmentStatus,

          firstCandidatePeriod:
            periods[0] ?? null,

          lastCandidatePeriod:
            periods[
              periods.length - 1
            ] ?? null,

          candidateChargeCount:
            periods.length,

          periods,
        };
      })
      .sort(
        (a, b) =>
          a.studentName.localeCompare(
            b.studentName,
          ) ||
          a.className.localeCompare(
            b.className,
          ),
      );

  const uniqueStudents =
    new Set(
      rows.map(
        (item) =>
          item.studentId,
      ),
    );

  const uniqueClasses =
    new Set(
      rows.map(
        (item) =>
          item.classId,
      ),
    );

  return {
    rows,

    enrollmentCount:
      rows.length,

    studentCount:
      uniqueStudents.size,

    classCount:
      uniqueClasses.size,

    chargeCount:
      reviewItems.length,
  };
}

function buildEnrollmentReviewSummary(
  enrollmentReview,
) {
  return groupCount(
    enrollmentReview,
    (item) =>
      item.result,
  );
}

function buildEnrollmentReviewByClass(
  enrollmentReview,
  result,
) {
  const filtered =
    enrollmentReview.filter(
      (item) =>
        item.result === result,
    );

  const byClass =
    new Map();

  for (const item of filtered) {
    const key =
      item.classId ??
      `NO_CLASS_ID|${item.className}`;

    if (!byClass.has(key)) {
      byClass.set(
        key,
        {
          classId:
            item.classId ?? null,

          className:
            item.className || '(sin nombre)',

          count:
            0,

          students:
            new Set(),

          enrollments:
            [],
        },
      );
    }

    const group =
      byClass.get(key);

    group.count++;

    if (item.studentId) {
      group.students.add(
        item.studentId,
      );
    }

    group.enrollments.push({
      enrollmentId:
        item.enrollmentId,

      studentId:
        item.studentId,

      studentName:
        item.studentName,

      startDate:
        item.startDate,

      endDate:
        item.endDate,

      status:
        item.status,
    });
  }

  return [...byClass.values()]
    .map((group) => ({
      classId:
        group.classId,

      className:
        group.className,

      enrollmentCount:
        group.count,

      studentCount:
        group.students.size,

      enrollments:
        group.enrollments,
    }))
    .sort(
      (a, b) =>
        b.enrollmentCount -
          a.enrollmentCount ||
        a.className.localeCompare(
          b.className,
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
    ' ANÁLISIS DE MONTHLY CHARGES HISTÓRICAS',
  );

  console.log(
    '=========================================================',
  );

  console.log('');

  console.log(
    `📄 Enrollments: ${ENROLLMENTS_FILE}`,
  );

  console.log(
    `📅 Analizando hasta: ${TODAY}`,
  );

  /* -------------------------------------------------------
   * 1. Enrollments
   * ------------------------------------------------------- */

  const enrollments =
    await readEnrollments();

  console.log(
    `🎓 Inscripciones cargadas: ${enrollments.length}`,
  );

  /* -------------------------------------------------------
   * 2. Login
   * ------------------------------------------------------- */

  console.log('');
  console.log(
    '🔐 Iniciando sesión...',
  );

  const sessionCookie =
    await login();

  console.log(
    '✅ Sesión iniciada.',
  );

  /* -------------------------------------------------------
   * 3. Tarifas reales de BDD
   * ------------------------------------------------------- */

  const tariffs =
    await apiJson(
      '/tariffs',
      sessionCookie,
    );

  if (
    !Array.isArray(
      tariffs,
    )
  ) {
    throw new Error(
      'GET /tariffs no devolvió un array.',
    );
  }

  console.log(
    `💰 Tarifas encontradas en BDD: ${tariffs.length}`,
  );

  const tariffsByClass =
    indexTariffsByClass(
      tariffs,
    );

  console.log(
    `💃 Clases con tarifas: ${tariffsByClass.size}`,
  );

  /* -------------------------------------------------------
   * 4. MonthlyCharge existentes
   * ------------------------------------------------------- */

  const existingCharges =
    await fetchExistingCharges(
      sessionCookie,
    );

  console.log(
    `🧾 Cuotas existentes detectadas: ${existingCharges.length}`,
  );

  const existingChargesByKey =
    new Map(
      existingCharges.map(
        (charge) => [
          existingChargeKey(
            charge.enrollmentId,
            charge.period,
          ),

          charge,
        ],
      ),
    );

  /* -------------------------------------------------------
   * 5. Candidatos
   * ------------------------------------------------------- */

  const {
    candidates,
    enrollmentReview,
  } =
    buildCandidates({
      enrollments,
      tariffsByClass,
      existingChargesByKey,
    });

  /* -------------------------------------------------------
   * 6. Duplicados y revisiones de enrollment
   * ------------------------------------------------------- */

  const duplicates =
    findCandidateDuplicates(
      candidates,
    );

    const reviewEndDateSummary =
  buildReviewEndDateSummary(
    candidates,
  );

const enrollmentReviewSummary =
  buildEnrollmentReviewSummary(
    enrollmentReview,
  );

const noTariffForClassSummary =
  buildEnrollmentReviewByClass(
    enrollmentReview,
    'NO_TARIFF_FOR_CLASS',
  );

const noOverlappingTariffSummary =
  buildEnrollmentReviewByClass(
    enrollmentReview,
    'NO_OVERLAPPING_TARIFF',
  );

const noOverlapReasonSummary =
  groupCount(
    enrollmentReview.filter(
      (item) =>
        item.result ===
        'NO_OVERLAPPING_TARIFF',
    ),

    (item) =>
      item.overlapType ??
      'UNKNOWN',
  );  

const enrollmentStatusSummary =
  groupCount(
    enrollments,
    (item) => {
      if (
        item.status === 'ACTIVE'
      ) {
        return 'ACTIVE';
      }

      if (
        item.status === 'ENDED' &&
        item.endDate
      ) {
        return 'ENDED_WITH_END_DATE';
      }

      return 'ENDED_WITHOUT_END_DATE';
    },
  );

  /* -------------------------------------------------------
   * 7. Resumen
   * ------------------------------------------------------- */

  const countResult =
    (result) =>
      candidates.filter(
        (item) =>
          item.result ===
          result,
      ).length;

  const safe =
    countResult(
      'SAFE',
    );

  const reviewEndDate =
    countResult(
      'REVIEW_END_DATE',
    );

  const alreadyExists =
    countResult(
      'ALREADY_EXISTS',
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

  console.log(
    `🧾 Candidatos totales: ${candidates.length}`,
  );

  console.log(
    `✅ SAFE: ${safe}`,
  );

  console.log(
    `⚠️ REVIEW_END_DATE: ${reviewEndDate}`,
  );

  console.log(
    `↩️ ALREADY_EXISTS: ${alreadyExists}`,
  );

  console.log(
    `📋 Inscripciones para revisar: ${enrollmentReview.length}`,
  );

  console.log(
    `💥 Candidatos duplicados: ${duplicates.length}`,
  );

  console.log('');
console.log(
  '--- ENROLLMENTS ---',
);

for (
  const item
  of enrollmentStatusSummary
) {
  console.log(
    `${item.key}: ${item.count}`,
  );
}

console.log('');
console.log(
  '--- REVIEW_END_DATE ---',
);

console.log(
  `Enrollments afectados: ${reviewEndDateSummary.enrollmentCount}`,
);

console.log(
  `Alumnos afectados: ${reviewEndDateSummary.studentCount}`,
);

console.log(
  `Clases afectadas: ${reviewEndDateSummary.classCount}`,
);

console.log(
  `Cuotas dudosas: ${reviewEndDateSummary.chargeCount}`,
);

console.log('');
console.log(
  '--- INSCRIPCIONES SIN CANDIDATOS ---',
);

for (
  const item
  of enrollmentReviewSummary
) {
  console.log(
    `${item.key}: ${item.count}`,
  );
}

console.log('');
console.log(
  '--- NO_TARIFF_FOR_CLASS POR CLASE ---',
);

for (
  const item
  of noTariffForClassSummary
) {
  console.log(
    `${item.className}: ${item.enrollmentCount} inscripciones / ${item.studentCount} alumnos`,
  );
}

console.log('');
console.log(
  '--- NO_OVERLAPPING_TARIFF POR CLASE ---',
);

console.log('');
console.log(
  '--- DIAGNÓSTICO NO_OVERLAPPING_TARIFF ---',
);

for (
  const item
  of noOverlapReasonSummary
) {
  console.log(
    `${item.key}: ${item.count}`,
  );
}

for (
  const item
  of noOverlappingTariffSummary
) {
  console.log(
    `${item.className}: ${item.enrollmentCount} inscripciones / ${item.studentCount} alumnos`,
  );
}

console.log('');
console.log(
  '--- DETALLE AFTER_LAST_TARIFF ---',
);

for (
  const item
  of enrollmentReview.filter(
    (row) =>
      row.result ===
        'NO_OVERLAPPING_TARIFF' &&
      row.overlapType ===
        'AFTER_LAST_TARIFF',
  )
) {
  console.log(
    `${item.className} | ${item.studentName} | inicio=${item.startDate} | última tarifa=${item.lastTariffTo}`,
  );
}

  /* -------------------------------------------------------
   * 8. JSON
   * ------------------------------------------------------- */

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

    analysisUntil:
      TODAY,

    source: {
      enrollments:
        ENROLLMENTS_FILE,

      tariffs:
        'API /tariffs',
    },

    summary: {
      enrollmentCount:
        enrollments.length,

      tariffCount:
        tariffs.length,

      classesWithTariffs:
        tariffsByClass.size,

      existingChargeCount:
        existingCharges.length,

      candidateCount:
        candidates.length,

      safe,

      reviewEndDate,

      alreadyExists,

      enrollmentReviewCount:
        enrollmentReview.length,

      duplicateCandidateCount:
        duplicates.length,
    reviewEndDateEnrollmentCount:
     reviewEndDateSummary.enrollmentCount,

    reviewEndDateStudentCount:
     reviewEndDateSummary.studentCount,

    reviewEndDateClassCount:
     reviewEndDateSummary.classCount,
    },

    candidates,

    enrollmentReview,

    duplicates,
    reviewEndDateSummary:
        reviewEndDateSummary.rows,

    enrollmentReviewSummary,

    noTariffForClassSummary,

    noOverlappingTariffSummary,

    enrollmentStatusSummary,

    noOverlapReasonSummary,
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

  /* -------------------------------------------------------
   * 9. XLSX
   * ------------------------------------------------------- */

  const workbook =
    utils.book_new();

  const candidateRows =
    candidates.map(
      (item) => ({
        Resultado:
          item.result,

        Motivo:
          item.reason,

        Alumno:
          item.studentName,

        DNI:
          item.studentDni,

        'Student ID':
          item.studentId,

        'Enrollment ID':
          item.enrollmentId,

        'Estado inscripción':
          item.enrollmentStatus,

        'Inicio inscripción':
          item.enrollmentStartDate,

        'Fin inscripción':
          item.enrollmentEndDate,

        Clase:
          item.className,

        'Class ID':
          item.classId,

        Período:
          item.period,

        Vencimiento:
          item.dueDate,

        'Tariff ID':
          item.tariffId,

        Tarifa:
          item.tariffName,

        'Estado tarifa':
          item.tariffStatus,

        'Tarifa desde':
          item.tariffValidFrom,

        'Tarifa hasta':
          item.tariffValidTo,

        'Importe base':
          item.baseAmount,

        Descuento:
          item.discountAmount,

        'Importe final':
          item.finalAmount,

        'Charge existente':
          item.existingChargeId,
      }),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      candidateRows,
    ),
    'Cuotas candidatas',
  );

  const reviewRows =
    enrollmentReview.map(
      (item) => ({
        Resultado:
          item.result,

        Motivo:
          item.reason,

        Alumno:
          item.studentName,

        'Student ID':
          item.studentId,

        'Enrollment ID':
          item.enrollmentId,

        Clase:
          item.className,

        'Class ID':
          item.classId,

        Estado:
          item.status,

        Inicio:
          item.startDate,

        Fin:
          item.endDate,

        'Tipo no solapamiento':
         item.overlapType ?? null,

        'Primera tarifa':
         item.firstTariffFrom ?? null,

        'Última tarifa':
         item.lastTariffTo ?? null,

        'Cantidad tarifas clase':
         item.tariffCount ?? null,  
      }),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      reviewRows,
    ),
    'Inscripciones revisar',
  );

    const noTariffForClassRows =
    noTariffForClassSummary.map(
        (item) => ({
        Clase:
            item.className,

        'Class ID':
            item.classId,

        Inscripciones:
            item.enrollmentCount,

        Alumnos:
            item.studentCount,
        }),
    );

    utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
        noTariffForClassRows,
    ),
    'Sin tarifa por clase',
    );



    
    const noOverlappingTariffRows =
    noOverlappingTariffSummary.map(
        (item) => ({
        Clase:
            item.className,

        'Class ID':
            item.classId,

        Inscripciones:
            item.enrollmentCount,

        Alumnos:
            item.studentCount,
        }),
    );

const noOverlapDetailRows =
  enrollmentReview
    .filter(
      (item) =>
        item.result ===
        'NO_OVERLAPPING_TARIFF',
    )
    .sort(
      (a, b) =>
        a.className.localeCompare(
          b.className,
        ) ||
        a.startDate.localeCompare(
          b.startDate,
        ),
    )
    .map(
      (item) => ({
        Clase:
          item.className,

        'Class ID':
          item.classId,

        Alumno:
          item.studentName,

        'Student ID':
          item.studentId,

        'Enrollment ID':
          item.enrollmentId,

        Estado:
          item.status,

        'Inicio inscripción':
          item.startDate,

        'Fin inscripción':
          item.endDate,

        Diagnóstico:
          item.overlapType,

        'Primera tarifa conocida':
          item.firstTariffFrom,

        'Última tarifa conocida':
          item.lastTariffTo,

        'Cantidad tarifas':
          item.tariffCount,

        Motivo:
          item.reason,
      }),
    );

    utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
        noOverlapDetailRows,
    ),
    'Sin solapamiento',
    );


    utils.book_append_sheet(
        workbook,
        utils.json_to_sheet(
            noOverlappingTariffRows,
        ),
        'Sin solapamiento resumen',
        );

    const noOverlapReasonRows =
        noOverlapReasonSummary.map(
            (item) => ({
            Diagnóstico:
                item.key,

            Cantidad:
                item.count,
            }),
        );

    utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
        noOverlapReasonRows,
    ),
    'Diagnóstico solapamiento',
    );

  const duplicateRows =
    duplicates.map(
      (item) => ({
        Clave:
          item.key,

        Alumno:
          item.duplicate
            ?.studentName,

        Clase:
          item.duplicate
            ?.className,

        Período:
          item.duplicate
            ?.period,

        'Enrollment ID':
          item.duplicate
            ?.enrollmentId,

        'Tariff 1':
          item.first
            ?.tariffId,

        'Tariff 2':
          item.duplicate
            ?.tariffId,
      }),
    );

    const reviewEndDateRows =
        reviewEndDateSummary.rows.map(
            (item) => ({
            Alumno:
                item.studentName,

            DNI:
                item.studentDni,

            'Student ID':
                item.studentId,

            'Enrollment ID':
                item.enrollmentId,

            Clase:
                item.className,

            'Class ID':
                item.classId,

            Estado:
                item.enrollmentStatus,

            'Inicio inscripción':
                item.enrollmentStartDate,

            'Fin inscripción':
                item.enrollmentEndDate,

            'Primer período candidato':
                item.firstCandidatePeriod,

            'Último período candidato':
                item.lastCandidatePeriod,

            'Cuotas dudosas':
                item.candidateChargeCount,

            Períodos:
                item.periods.join(
                ' | ',
                ),
            }),
        );

    utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
        reviewEndDateRows,
    ),
    'Resumen REVIEW_END_DATE',
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      duplicateRows,
    ),
    'Duplicados',
  );
  
  const enrollmentReviewSummaryRows =
    enrollmentReviewSummary.map(
        (item) => ({
        Motivo:
            item.key,

        Cantidad:
            item.count,
        }),
    );

    utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
        enrollmentReviewSummaryRows,
    ),
    'Resumen revisión',
    );

  const summaryRows = [
    {
      Métrica:
        'Inscripciones',

      Valor:
        enrollments.length,
    },
    {
      Métrica:
        'Tarifas',

      Valor:
        tariffs.length,
    },
    {
      Métrica:
        'Clases con tarifas',

      Valor:
        tariffsByClass.size,
    },
    {
      Métrica:
        'Cuotas existentes',

      Valor:
        existingCharges.length,
    },
    {
      Métrica:
        'Candidatos totales',

      Valor:
        candidates.length,
    },
    {
      Métrica:
        'SAFE',

      Valor:
        safe,
    },
    {
      Métrica:
        'REVIEW_END_DATE',

      Valor:
        reviewEndDate,
    },
    {
      Métrica:
        'ALREADY_EXISTS',

      Valor:
        alreadyExists,
    },
    {
      Métrica:
        'Inscripciones para revisar',

      Valor:
        enrollmentReview.length,
    },
    {
      Métrica:
        'Candidatos duplicados',

      Valor:
        duplicates.length,
    },
    {
    Métrica:
        'Enrollments REVIEW_END_DATE',

    Valor:
        reviewEndDateSummary.enrollmentCount,
    },
    {
    Métrica:
        'Alumnos REVIEW_END_DATE',

    Valor:
        reviewEndDateSummary.studentCount,
    },
    {
    Métrica:
        'Clases REVIEW_END_DATE',

    Valor:
        reviewEndDateSummary.classCount,
    },
    {
    Métrica:
        'Clases NO_TARIFF_FOR_CLASS',

    Valor:
        noTariffForClassSummary.length,
    },
    {
    Métrica:
        'Clases NO_OVERLAPPING_TARIFF',

    Valor:
        noOverlappingTariffSummary.length,
    },
  ];

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      summaryRows,
    ),
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

  if (
    duplicates.length >
    0
  ) {
    console.log(
      '⚠️ Hay candidatos duplicados. No conviene importar cuotas todavía.',
    );
  }

  if (
    reviewEndDate >
    0
  ) {
    console.log(
      '⚠️ Hay cuotas REVIEW_END_DATE. Necesitamos resolver el fin real de esas inscripciones antes de importarlas.',
    );
  }

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
        ? error.message
        : error,
    );

    process.exitCode =
      1;
  },
);