import fs from 'node:fs/promises';
import path from 'node:path';
import process, { loadEnvFile } from 'node:process';
import xlsx from 'xlsx';
import { PrismaClient } from '@academy/database';

/*
 * Análisis histórico de movimientos de caja (junio-octubre 2026).
 *
 * IMPORTANTE:
 * Este script es exclusivamente de lectura. No crea, modifica ni elimina
 * alumnos, inscripciones, cuotas o pagos.
 *
 * Ejecución desde la raíz del monorepo:
 *
 * node scripts/analyze-june-2026-payments.mjs
 *
 * Con una ruta de Excel diferente:
 * node scripts/analyze-june-2026-payments.mjs "./ruta/al/reporte.xlsx"
 *
 * Solo analizar el Excel, sin consultar la base de datos:
 * node scripts/analyze-june-2026-payments.mjs --report-only
 */

try {
  loadEnvFile('.env');
} catch {
  // Puede que las variables ya estén cargadas en el entorno.
}

const { readFile, utils, writeFile } = xlsx;
const args = process.argv.slice(2);
const reportOnly = args.includes('--report-only');
const inputArgument = args.find((arg) => !arg.startsWith('--'));

const INPUT_FILE = path.resolve(
  inputArgument ?? './scripts/data/ReporteMovimientosDeCajaDetallado.xlsx',
);

const OUTPUT_DIR = path.resolve('./exports');

const OUTPUT_JSON = path.join(OUTPUT_DIR, 'june-oct-2026-payments-analysis.json');

const OUTPUT_XLSX = path.join(OUTPUT_DIR, 'june-oct-2026-payments-analysis.xlsx');

const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIMEZONE ?? 'America/Argentina/Cordoba';

let activePrismaClient = null;

/* =========================================================
 * CONSTANTES Y EQUIVALENCIAS
 * ========================================================= */

const MONTHS = {
  ENE: 1,
  ENERO: 1,
  FEB: 2,
  FEBRERO: 2,
  MAR: 3,
  MARZO: 3,
  ABR: 4,
  ABRIL: 4,
  MAY: 5,
  MAYO: 5,
  JUN: 6,
  JUNIO: 6,
  JUL: 7,
  JULIO: 7,
  AGO: 8,
  AGOSTO: 8,
  SEP: 9,
  SEPT: 9,
  SET: 9,
  SEPTIEMBRE: 9,
  SETIEMBRE: 9,
  OCT: 10,
  OCTUBRE: 10,
  NOV: 11,
  NOVIEMBRE: 11,
  DIC: 12,
  DICIEMBRE: 12,
};

const MOVEMENT_TYPES = [
  {
    key: 'QUOTA',
    label: 'Pago de cuota',
    pattern: /PAGO\s+DE\s+CUOTA/i,
  },
  {
    key: 'REGISTRATION',
    label: 'Pago registro de socio',
    pattern: /PAGO\s+REGISTRO\s+DE\s+SOCIO/i,
  },
  {
    key: 'NEW_ACTIVITY',
    label: 'Pago de nueva actividad',
    pattern: /PAGO\s+DE\s+NUEVA\s+ACTIVIDAD/i,
  },
  {
    key: 'DAY_PASS',
    label: 'Pago por día',
    pattern: /PAGO\s+POR\s+D[IÍ]A/i,
  },
  {
    key: 'ACCOUNT_MOVEMENT',
    label: 'Movimiento en la cuenta',
    pattern: /MOVIMIENTO\s+EN\s+LA\s+CUENTA/i,
  },
];

/*
 * Equivalencias conocidas entre los nombres históricos del reporte
 * y los nombres de las clases de la aplicación.
 *
 * Las equivalencias ambiguas quedan marcadas para revisión.
 */

const CLASS_ALIASES = new Map([
  [
    normalizeText('Coreografico_Puchini'),
    {
      names: ['Grupo C. Sofi', 'Clase femenino Sofi'],
      reason: 'El nombre histórico puede corresponder a Grupo C. Sofi o Clase femenino Sofi.',
    },
  ],
  [
    normalizeText('Coreografico_Frank'),
    {
      names: ['Grupo C. - A.Frank'],
      reason: null,
    },
  ],
  [
    normalizeText('S&B Parejas'),
    {
      names: ['Salsa y Bachata en Pareja'],
      reason: null,
    },
  ],
  [
    normalizeText('Hells'),
    {
      names: ['Heels'],
      reason: null,
    },
  ],
  [
    normalizeText('Kizomba'),
    {
      names: ['Clase kizomba'],
      reason: null,
    },
  ],
  [
    normalizeText('Coreografico E.Masc-Bachata/Urban'),
    {
      names: ['Coreográfico E.Masc-Bachata/Urban', 'Urbanflow'],
      reason: 'No se confirmó la fecha exacta en que la actividad pasó a llamarse Urbanflow.',
    },
  ],
]);

/*
 * Equivalencias confirmadas por la academia en
 * scripts/controlfit-class-mapping.json. Reemplazan a las
 * equivalencias internas con la misma actividad; una lista
 * vacía deja la actividad pendiente.
 */

const CLASS_MAPPING_FILE = path.resolve('./scripts/controlfit-class-mapping.json');

try {
  const mapping = JSON.parse(await fs.readFile(CLASS_MAPPING_FILE, 'utf8'));

  for (const [activity, entry] of Object.entries(mapping.aliases ?? {})) {
    const names = Array.isArray(entry) ? entry : (entry?.names ?? []);

    if (names.length > 0) {
      CLASS_ALIASES.set(normalizeText(activity), {
        names,
        fallback: Array.isArray(entry) ? null : (entry.fallback ?? null),
        reason: null,
      });
    }
  }
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

/* =========================================================
 * NORMALIZACIÓN
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

function normalizeDni(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase();
  }

  // Igual que la API: el DNI se guarda solamente con dígitos.
  return String(value).replace(/\D/g, '');
}

function roundMoney(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseMoney(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return roundMoney(value);
  }

  let text = String(value)
    .trim()
    .replace(/[^\d,.-]/g, '');

  if (!text) {
    return null;
  }

  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');

  if (comma >= 0 && dot >= 0) {
    if (comma > dot) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (comma >= 0) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (dot >= 0) {
    const parts = text.split('.');

    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      text = parts.join('');
    }
  }

  const number = Number(text);

  return Number.isFinite(number) ? roundMoney(number) : null;
}

/* =========================================================
 * FECHAS
 * ========================================================= */

function isoDateFromUtcDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function isoDateInBusinessZone(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function parseExcelDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = xlsx.SSF.parse_date_code(value);

    if (!parsed) {
      return null;
    }

    return new Date(
      Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, Math.floor(parsed.S)),
    );
  }

  if (typeof value === 'string' && value.trim()) {
    const text = value.trim();

    const normalized = text.includes('T') ? text : text.replace(' ', 'T');

    const date = new Date(normalized);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function dateOnly(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return isoDateFromUtcDate(value);
  }

  const text = String(value);

  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

function makeUtcDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function dayDifference(start, end) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/*
 * El reporte incluye períodos como:
 *
 * 10-MAY/10-JUN
 * 10-JUN/10-JUL
 *
 * Como el Excel no indica el año en el período abonado,
 * se infiere tomando como referencia la fecha del pago.
 *
 * La inferencia sirve para el análisis; no constituye
 * una autorización automática para importar el movimiento.
 */

function inferPeriodDates(periodParts, paymentDateIso) {
  if (!periodParts || !paymentDateIso) {
    return null;
  }

  const paymentDate = new Date(`${paymentDateIso}T00:00:00.000Z`);

  const paymentYear = paymentDate.getUTCFullYear();

  const candidates = [];

  for (let startYear = paymentYear - 1; startYear <= paymentYear + 1; startYear += 1) {
    for (const endYear of [startYear, startYear + 1]) {
      const start = makeUtcDate(startYear, periodParts.startMonth, periodParts.startDay);

      const end = makeUtcDate(endYear, periodParts.endMonth, periodParts.endDay);

      if (!start || !end || end <= start) {
        continue;
      }

      const durationDays = dayDifference(start, end);

      if (durationDays < 1 || durationDays > 370) {
        continue;
      }

      let distanceDays = 0;

      if (paymentDate < start) {
        distanceDays = dayDifference(paymentDate, start);
      } else if (paymentDate > end) {
        distanceDays = dayDifference(end, paymentDate);
      }

      const yearPenalty = Math.abs(startYear - paymentYear) * 0.01;

      candidates.push({
        start,
        end,
        durationDays,
        score: distanceDays + yearPenalty,
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score);

  if (!candidates.length) {
    return null;
  }

  if (candidates.length > 1 && Math.abs(candidates[0].score - candidates[1].score) < 0.001) {
    return { ambiguous: true };
  }

  const chosen = candidates[0];

  const periodType =
    chosen.durationDays <= 10
      ? 'WEEKLY'
      : chosen.durationDays >= 25 && chosen.durationDays <= 35
        ? 'MONTHLY'
        : 'NONSTANDARD';

  const startDate = isoDateFromUtcDate(chosen.start);

  return {
    startDate,
    endDate: isoDateFromUtcDate(chosen.end),
    durationDays: chosen.durationDays,
    periodType,
    chargePeriod: periodType === 'MONTHLY' ? startDate.slice(0, 7) : null,
    distanceFromPaymentDays: Math.max(0, Math.round(chosen.score)),
  };
}

function parseBilledPeriod(activityText, paymentDateIso) {
  const normalized = String(activityText ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  const match = normalized.match(
    /PERIODO\s+ABONADO\s*:\s*(\d{1,2})\s*-\s*([A-Z]+)\s*\/\s*(\d{1,2})\s*-\s*([A-Z]+)/,
  );

  if (!match) {
    return {
      raw: null,
      parsed: null,
      error: 'No se encontró la etiqueta Período abonado.',
    };
  }

  const startDay = Number(match[1]);
  const startMonth = MONTHS[normalizeText(match[2])];

  const endDay = Number(match[3]);
  const endMonth = MONTHS[normalizeText(match[4])];

  if (!startMonth || !endMonth || startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31) {
    return {
      raw: match[0],
      parsed: null,
      error: 'El período contiene un día o mes no reconocido.',
    };
  }

  const parsed = inferPeriodDates(
    {
      startDay,
      startMonth,
      endDay,
      endMonth,
    },
    paymentDateIso,
  );

  if (!parsed) {
    return {
      raw: match[0],
      parsed: null,
      error: 'No se pudo inferir el año del período.',
    };
  }

  if (parsed.ambiguous) {
    return {
      raw: match[0],
      parsed: null,
      error: 'El año del período quedó ambiguo.',
    };
  }

  return {
    raw: match[0],
    parsed,
    error: null,
  };
}

/* =========================================================
 * TIPO DE MOVIMIENTO Y MÉTODO DE PAGO
 * ========================================================= */

function classifyMovement(activityText) {
  const match = MOVEMENT_TYPES.find((type) => type.pattern.test(String(activityText ?? '')));

  return (
    match ?? {
      key: 'OTHER',
      label: 'Tipo no reconocido',
    }
  );
}

function mapPaymentMethod(value) {
  const key = normalizeText(value);

  if (key === 'EFECTIVO' || key === 'CASH') {
    return {
      normalized: 'CASH',
      supported: true,
    };
  }

  if (key === 'MERCADO PAGO' || key === 'MERCADOPAGO') {
    return {
      normalized: 'MERCADO_PAGO',
      supported: true,
    };
  }

  if (
    key === 'DEBITO' ||
    key === 'CREDITO' ||
    key === 'TARJETA' ||
    key === 'TARJETA DE DEBITO' ||
    key === 'TARJETA DE CREDITO'
  ) {
    return {
      normalized: 'CARD',
      supported: true,
    };
  }

  if (key === 'TRANSFERENCIA' || key === 'TRANSFER') {
    return {
      normalized: 'TRANSFER',
      supported: false,
    };
  }

  return {
    normalized: 'UNKNOWN',
    supported: false,
  };
}

/* =========================================================
 * LECTURA DEL EXCEL
 * ========================================================= */

function findHeaderRow(rows) {
  return rows.findIndex((row) => {
    const cells = row.map((cell) => normalizeText(cell));

    return (
      row.some((cell) => String(cell ?? '').trim() === '#') &&
      cells.includes('DNI') &&
      cells.includes('ACTIVIDAD') &&
      cells.includes('FECHA HORA') &&
      cells.includes('TOTAL')
    );
  });
}

function parseFooterTotal(rows) {
  for (const row of rows) {
    for (let index = 0; index < row.length; index += 1) {
      const value = row[index];

      const text = String(value ?? '').trim();

      if (!/^TOTAL\s*:/i.test(text)) {
        continue;
      }

      const embedded = text.match(/^TOTAL\s*:\s*([\d.,-]+)/i);

      if (embedded) {
        return parseMoney(embedded[1]);
      }

      for (let next = index + 1; next < row.length; next += 1) {
        if (row[next] !== null && row[next] !== undefined && row[next] !== '') {
          return parseMoney(row[next]);
        }
      }
    }
  }

  return null;
}

function readReport(filePath) {
  const workbook = readFile(filePath, {
    cellDates: true,
    raw: true,
  });

  if (!workbook.SheetNames.length) {
    throw new Error('El Excel no contiene hojas.');
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });

  const headerIndex = findHeaderRow(rows);

  if (headerIndex < 0) {
    throw new Error('No encontré la fila de encabezados (#, DNI, Actividad, Fecha/Hora, Total).');
  }

  const headers = rows[headerIndex];
  const indexes = {};

  headers.forEach((header, index) => {
    const key = String(header ?? '').trim() === '#' ? '#' : normalizeText(header);

    if (key) {
      indexes[key] = index;
    }
  });

  const required = [
    '#',
    'DNI',
    'APELLIDO',
    'NOMBRE',
    'ACTIVIDAD',
    'COSTO',
    'FECHA HORA',
    'PAGO',
    'TOTAL',
  ];

  const missing = required.filter((key) => indexes[key] === undefined);

  if (missing.length) {
    throw new Error(`Faltan columnas requeridas en el reporte: ${missing.join(', ')}.`);
  }

  const footerTotal = parseFooterTotal(rows);
  const items = [];

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];

    const movementNumber = row[indexes['#']];

    if (movementNumber === null || movementNumber === undefined || movementNumber === '') {
      continue;
    }

    if (!Number.isFinite(Number(movementNumber))) {
      continue;
    }

    const activityText = String(row[indexes.ACTIVIDAD] ?? '').trim();

    const paymentDate = parseExcelDate(row[indexes['FECHA HORA']]);

    const paymentDateIso = paymentDate ? isoDateFromUtcDate(paymentDate) : null;

    const period = parseBilledPeriod(activityText, paymentDateIso);

    const movementType = classifyMovement(activityText);

    const paymentMethod = mapPaymentMethod(row[indexes.PAGO]);

    const cost = parseMoney(row[indexes.COSTO]);

    const total = parseMoney(row[indexes.TOTAL]);

    const activityName = activityText.split('|')[0].trim();

    items.push({
      sourceRow: index + 1,
      movementNumber: Number(movementNumber),

      dniRaw: row[indexes.DNI] === null ? '' : String(row[indexes.DNI]).trim(),

      dniNormalized: normalizeDni(row[indexes.DNI]),

      lastName: String(row[indexes.APELLIDO] ?? '').trim(),

      firstName: String(row[indexes.NOMBRE] ?? '').trim(),

      activityText,
      activityName,
      activityKey: normalizeText(activityName),

      movementType: movementType.key,
      movementTypeLabel: movementType.label,

      cost,

      paymentDate: paymentDateIso,

      paymentDateTime: paymentDate ? paymentDate.toISOString() : null,

      paymentMethodRaw: String(row[indexes.PAGO] ?? '').trim(),

      paymentMethod: paymentMethod.normalized,
      paymentMethodSupported: paymentMethod.supported,

      total,

      amountDifference: cost !== null && total !== null ? roundMoney(total - cost) : null,

      periodRaw: period.raw,
      periodStart: period.parsed?.startDate ?? null,
      periodEnd: period.parsed?.endDate ?? null,
      periodDays: period.parsed?.durationDays ?? null,
      periodType: period.parsed?.periodType ?? null,
      chargePeriod: period.parsed?.chargePeriod ?? null,

      periodParseError: period.error,

      flags: [],
      classification: null,
    });
  }

  return {
    workbookName: path.basename(filePath),
    sheetName: workbook.SheetNames[0],
    headerRow: headerIndex + 1,
    footerTotal,
    items,
  };
}

/* =========================================================
 * ÍNDICES DE LA BASE DE DATOS
 * ========================================================= */

function buildStudentIndex(students) {
  const byDni = new Map();

  for (const student of students) {
    const key = normalizeDni(student.dni);

    if (!key) {
      continue;
    }

    if (!byDni.has(key)) {
      byDni.set(key, []);
    }

    byDni.get(key).push(student);
  }

  return byDni;
}

function buildClassIndex(classes) {
  const byName = new Map();
  const byId = new Map();

  for (const academicClass of classes) {
    byId.set(academicClass.id, academicClass);

    const key = normalizeText(academicClass.name);

    if (!byName.has(key)) {
      byName.set(key, []);
    }

    byName.get(key).push(academicClass);
  }

  return {
    byName,
    byId,
  };
}

function buildEnrollmentsByStudentClass(enrollments) {
  const index = new Map();

  for (const enrollment of enrollments) {
    const key = `${enrollment.studentId}|${enrollment.classId}`;

    if (!index.has(key)) {
      index.set(key, []);
    }

    index.get(key).push(enrollment);
  }

  return index;
}

/* =========================================================
 * RESOLUCIÓN DE CLASE
 * ========================================================= */

function resolveClassForStudent(item, studentId, classIndex, enrollmentsByStudentClass) {
  const exact = classIndex.byName.get(item.activityKey) ?? [];

  if (exact.length === 1) {
    return {
      academicClass: exact[0],
      aliasUsed: false,
      reviewReason: null,
    };
  }

  if (exact.length > 1) {
    return {
      academicClass: null,
      aliasUsed: false,
      reviewReason: 'Hay más de una clase con el mismo nombre normalizado.',
    };
  }

  const alias = CLASS_ALIASES.get(item.activityKey);

  if (!alias) {
    return {
      academicClass: null,
      aliasUsed: false,
      reviewReason: null,
    };
  }

  const candidateClasses = alias.names
    .flatMap((name) => classIndex.byName.get(normalizeText(name)) ?? [])
    .filter(
      (academicClass, index, all) =>
        all.findIndex((candidate) => candidate.id === academicClass.id) === index,
    );

  if (candidateClasses.length === 1) {
    const selected = candidateClasses[0];

    const transitionReview =
      item.activityKey === normalizeText('Coreografico E.Masc-Bachata/Urban') &&
      normalizeText(selected.name) === normalizeText('Urbanflow');

    return {
      academicClass: selected,
      aliasUsed: true,
      reviewReason: transitionReview ? alias.reason : null,
    };
  }

  if (candidateClasses.length > 1 && studentId) {
    const enrolledCandidates = candidateClasses.filter(
      (academicClass) =>
        (enrollmentsByStudentClass.get(`${studentId}|${academicClass.id}`) ?? []).length > 0,
    );

    if (enrolledCandidates.length === 1) {
      return {
        academicClass: enrolledCandidates[0],
        aliasUsed: true,
        reviewReason: alias.reason,
      };
    }

    const fallback = alias.fallback
      ? candidateClasses.find(
          (academicClass) => normalizeText(academicClass.name) === normalizeText(alias.fallback),
        )
      : null;

    if (fallback) {
      return {
        academicClass: fallback,
        aliasUsed: true,
        reviewReason: null,
      };
    }

    if (enrolledCandidates.length > 1) {
      return {
        academicClass: null,
        aliasUsed: true,
        reviewReason: 'El alumno tiene inscripciones en más de una clase candidata del alias.',
      };
    }
  }

  return {
    academicClass: null,
    aliasUsed: true,
    reviewReason: alias.reason ?? 'El alias no se pudo resolver contra una única clase.',
  };
}

/* =========================================================
 * INSCRIPCIONES Y TARIFAS
 * ========================================================= */

function findEnrollment(item, studentId, classId, enrollmentsByStudentClass) {
  const candidates = enrollmentsByStudentClass.get(`${studentId}|${classId}`) ?? [];

  if (!candidates.length) {
    return {
      enrollment: null,
      reason: 'No hay inscripción del alumno para esta clase.',
    };
  }

  if (candidates.length === 1) {
    return {
      enrollment: candidates[0],
      reason: null,
    };
  }

  const withinDates = candidates.filter((enrollment) => {
    if (!item.periodStart || !item.periodEnd) {
      return false;
    }

    const startDate = dateOnly(enrollment.startDate);

    const endDate = dateOnly(enrollment.endDate);

    return Boolean(
      startDate && item.periodStart >= startDate && (!endDate || item.periodEnd <= endDate),
    );
  });

  if (withinDates.length === 1) {
    return {
      enrollment: withinDates[0],
      reason: null,
    };
  }

  return {
    enrollment: null,
    reason: 'Hay varias inscripciones posibles y no se puede elegir una con seguridad.',
  };
}

function findTariff(item, classId, tariffs) {
  if (!classId) {
    return {
      tariff: null,
      reason: 'No se pudo identificar la clase.',
    };
  }

  const classLinkedTariffs = tariffs.filter(
    (tariff) => (tariff.classId ?? tariff.academyClassId) === classId,
  );

  if (!classLinkedTariffs.length) {
    const hasClassLinks = tariffs.some((tariff) => tariff.classId || tariff.academyClassId);

    return {
      tariff: null,
      reason: hasClassLinks
        ? 'No hay tarifa asociada a esta clase.'
        : 'Las tarifas disponibles no exponen classId; no se puede validar automáticamente la tarifa por clase.',
    };
  }

  if (!item.periodStart) {
    return {
      tariff: null,
      reason: 'No hay fecha de inicio del período para validar la tarifa.',
    };
  }

  const candidates = classLinkedTariffs.filter((tariff) => {
    const validFrom = dateOnly(tariff.validFrom);

    const validTo = dateOnly(tariff.validTo);

    return Boolean(
      validFrom && validFrom <= item.periodStart && (!validTo || validTo >= item.periodStart),
    );
  });

  if (candidates.length === 0) {
    return {
      tariff: null,
      reason: 'No se encontró una tarifa vigente para la fecha de inicio del período.',
    };
  }

  if (candidates.length > 1) {
    return {
      tariff: null,
      reason: 'Hay más de una tarifa vigente para la misma clase y fecha.',
    };
  }

  const tariff = candidates[0];
  const validTo = dateOnly(tariff.validTo);

  if (validTo && item.periodEnd && validTo < item.periodEnd) {
    const continuations = classLinkedTariffs.filter((candidate) => {
      const nextFrom = dateOnly(candidate.validFrom);

      const nextTo = dateOnly(candidate.validTo);

      return Boolean(
        nextFrom &&
          nextFrom > validTo &&
          nextFrom <= item.periodEnd &&
          (!nextTo || nextTo >= item.periodEnd),
      );
    });

    if (
      continuations.length === 1 &&
      Math.abs(parseMoney(continuations[0].amount) - parseMoney(tariff.amount)) < 0.009
    ) {
      return {
        tariff,
        reason: null,
      };
    }

    if (continuations.length > 0) {
      return {
        tariff,
        reason: 'Hay un cambio de tarifa o más de una tarifa durante el período abonado.',
      };
    }

    return {
      tariff,
      reason:
        'La tarifa seleccionada no cubre todo el período abonado y no se encontró una tarifa que cubra el resto del ciclo.',
    };
  }

  return {
    tariff,
    reason: null,
  };
}

/* =========================================================
 * CUOTAS EXISTENTES Y ALERTAS
 * ========================================================= */

function indexExistingCharges(charges) {
  const index = new Map();

  for (const charge of charges) {
    const period = dateOnly(charge.period)?.slice(0, 7);

    if (!period) {
      continue;
    }

    const key = `${charge.enrollmentId}|${period}`;

    if (!index.has(key)) {
      index.set(key, []);
    }

    index.get(key).push(charge);
  }

  return index;
}

function flag(item, code, detail = null) {
  if (!item.flags.some((entry) => entry.code === code)) {
    item.flags.push({
      code,
      detail,
    });
  }
}

function addDataQualityFlags(item) {
  if (item.movementType !== 'QUOTA') {
    return;
  }

  if (!item.dniNormalized) {
    flag(item, 'NO_DNI', 'El movimiento no tiene DNI para identificar al alumno.');
  }

  if (!item.paymentDate) {
    flag(item, 'INVALID_PAYMENT_DATE', 'No se pudo interpretar la fecha del movimiento.');
  }

  if (!item.periodRaw || !item.periodStart || !item.periodEnd) {
    flag(item, 'PERIOD_NOT_PARSED', item.periodParseError);
  }

  if (item.periodType === 'WEEKLY') {
    flag(
      item,
      'WEEKLY_PERIOD',
      'El período parece semanal; no debe convertirse automáticamente en cuota mensual.',
    );
  }

  if (item.periodType === 'NONSTANDARD') {
    flag(item, 'NONSTANDARD_PERIOD', 'La duración del período no parece mensual ni semanal.');
  }

  if (!item.paymentMethodSupported) {
    flag(
      item,
      'UNSUPPORTED_PAYMENT_METHOD',
      `Método no soportado por el esquema actual: ${item.paymentMethodRaw || '(vacío)'}.`,
    );
  }

  if (item.cost === null || item.total === null) {
    flag(item, 'INVALID_AMOUNT', 'Costo o total no numérico.');
  }

  if (item.cost !== null && item.total !== null && Math.abs(item.total - item.cost) > 0.009) {
    if (item.total < item.cost) {
      flag(
        item,
        'TOTAL_BELOW_COST',
        'El total cobrado es menor que el costo; no se puede asumir si fue descuento, pago parcial u otra condición.',
      );
    } else if (Math.abs(item.total - item.cost - 1000) < 0.009) {
      flag(
        item,
        'POSSIBLE_LATE_FEE_1000',
        'El total es exactamente $1.000 mayor que el costo; podría ser recargo, pero debe confirmarse.',
      );
    } else {
      flag(
        item,
        'TOTAL_ABOVE_COST',
        'El total cobrado supera el costo por un importe distinto de $1.000.',
      );
    }
  }
}

/* =========================================================
 * CONTRASTE CON LA BASE DE DATOS
 * ========================================================= */

function enrichItemsWithDatabase(items, db) {
  const studentsByDni = buildStudentIndex(db.students);

  const classIndex = buildClassIndex(db.classes);

  const enrollmentsByStudentClass = buildEnrollmentsByStudentClass(db.enrollments);

  const chargesByEnrollmentPeriod = indexExistingCharges(db.charges);

  const tendersByPayment = new Map();

  for (const tender of db.tenders) {
    if (!tendersByPayment.has(tender.paymentId)) {
      tendersByPayment.set(tender.paymentId, []);
    }

    tendersByPayment.get(tender.paymentId).push(tender);
  }

  for (const item of items) {
    addDataQualityFlags(item);

    if (item.movementType !== 'QUOTA') {
      item.classification = 'OTHER_MOVEMENT';

      continue;
    }

    const studentMatches = item.dniNormalized ? (studentsByDni.get(item.dniNormalized) ?? []) : [];

    if (!item.dniNormalized) {
      item.classification = 'REVIEW';
      continue;
    }

    if (studentMatches.length === 0) {
      flag(
        item,
        'STUDENT_NOT_FOUND',
        'El DNI del reporte no coincide con ningún alumno de la base de datos.',
      );

      item.classification = 'REVIEW';
      continue;
    }

    if (studentMatches.length > 1) {
      flag(item, 'DUPLICATE_DNI_IN_DATABASE', 'Más de un alumno coincide con el DNI normalizado.');

      item.classification = 'REVIEW';
      continue;
    }

    const student = studentMatches[0];

    item.studentId = student.id;

    item.studentNameDatabase = `${student.lastName ?? ''} ${student.firstName ?? ''}`.trim();

    item.studentStatus = student.status ?? null;

    const classResolution = resolveClassForStudent(
      item,
      student.id,
      classIndex,
      enrollmentsByStudentClass,
    );

    if (!classResolution.academicClass) {
      flag(
        item,
        'CLASS_NOT_RESOLVED',
        classResolution.reviewReason ??
          'No se pudo asociar la actividad del reporte a una clase de la base de datos.',
      );

      item.classification = 'REVIEW';
      continue;
    }

    const academicClass = classResolution.academicClass;

    item.classId = academicClass.id;
    item.classNameDatabase = academicClass.name;

    item.classAliasUsed = classResolution.aliasUsed;

    if (classResolution.reviewReason) {
      flag(item, 'CLASS_ALIAS_REVIEW', classResolution.reviewReason);
    }

    const enrollmentResult = findEnrollment(
      item,
      student.id,
      academicClass.id,
      enrollmentsByStudentClass,
    );

    if (!enrollmentResult.enrollment) {
      flag(item, 'ENROLLMENT_NOT_RESOLVED', enrollmentResult.reason);

      item.classification = 'REVIEW';
      continue;
    }

    const enrollment = enrollmentResult.enrollment;

    item.enrollmentId = enrollment.id;

    item.enrollmentStatus = enrollment.status ?? null;

    item.enrollmentStartDate = dateOnly(enrollment.startDate);

    item.enrollmentEndDate = dateOnly(enrollment.endDate);

    if (item.periodStart && item.periodEnd) {
      if (item.enrollmentStartDate && item.periodStart < item.enrollmentStartDate) {
        flag(
          item,
          'PERIOD_BEFORE_ENROLLMENT',
          `El período empieza antes de la inscripción (${item.enrollmentStartDate}).`,
        );
      }

      if (item.enrollmentEndDate && item.periodEnd > item.enrollmentEndDate) {
        flag(
          item,
          'PERIOD_AFTER_ENROLLMENT',
          `El período termina después de la baja (${item.enrollmentEndDate}).`,
        );
      }

      if (enrollment.status === 'ENDED' && !item.enrollmentEndDate) {
        flag(
          item,
          'ENDED_ENROLLMENT_WITHOUT_END_DATE',
          'La inscripción figura ENDED pero no tiene fecha de baja.',
        );
      }
    }

    if (item.periodType === 'MONTHLY' && item.chargePeriod) {
      const tariffResult = findTariff(item, academicClass.id, db.tariffs);

      if (tariffResult.tariff) {
        const tariff = tariffResult.tariff;

        item.tariffId = tariff.id;
        item.tariffName = tariff.name ?? null;

        item.tariffAmount = parseMoney(tariff.amount);

        item.tariffValidFrom = dateOnly(tariff.validFrom);

        item.tariffValidTo = dateOnly(tariff.validTo);

        item.tariffStatus = tariff.status ?? null;

        if (tariffResult.reason) {
          flag(item, 'TARIFF_PERIOD_REVIEW', tariffResult.reason);
        }

        if (
          item.cost !== null &&
          item.tariffAmount !== null &&
          Math.abs(item.cost - item.tariffAmount) > 0.009
        ) {
          flag(
            item,
            'COST_DIFFERS_FROM_TARIFF',
            `Costo reportado $${item.cost.toFixed(2)}; tarifa registrada $${item.tariffAmount.toFixed(2)}.`,
          );
        }
      } else {
        flag(item, 'TARIFF_NOT_FOUND', tariffResult.reason);
      }

      const chargeMatches =
        chargesByEnrollmentPeriod.get(`${enrollment.id}|${item.chargePeriod}`) ?? [];

      if (chargeMatches.length === 1) {
        const charge = chargeMatches[0];

        item.existingChargeId = charge.id;

        item.existingChargeStatus = charge.status;

        item.existingChargeFinalAmount = parseMoney(charge.finalAmount);
      } else if (chargeMatches.length > 1) {
        flag(
          item,
          'MULTIPLE_EXISTING_CHARGES',
          'Hay más de una cuota registrada para la inscripción y el mes.',
        );
      } else {
        item.existingChargeId = null;
        item.existingChargeStatus = 'NOT_FOUND';
      }
    } else if (item.periodType === 'WEEKLY') {
      flag(
        item,
        'MONTHLY_CHARGE_NOT_APPLICABLE',
        'El modelo de cuota mensual no representa directamente este período semanal.',
      );
    }

    /*
     * Busca pagos existentes con alumno, fecha, importe y método compatibles.
     * Esto es una alerta de posible coincidencia, no una prueba de duplicación.
     */

    const reportDate = item.paymentDate;

    const existingPaymentCandidates = db.payments.filter((payment) => {
      if (payment.status === 'VOID' || payment.studentId !== student.id) {
        return false;
      }

      const sameDate = isoDateInBusinessZone(payment.paidAt) === reportDate;

      const sameAmount =
        item.total !== null && Math.abs(parseMoney(payment.amount) - item.total) < 0.009;

      if (!sameDate || !sameAmount) {
        return false;
      }

      const paymentTenders = tendersByPayment.get(payment.id) ?? [];

      if (item.paymentMethodSupported) {
        return paymentTenders.some(
          (tender) =>
            tender.method === item.paymentMethod &&
            Math.abs(parseMoney(tender.amount) - item.total) < 0.009,
        );
      }

      return true;
    });

    item.possibleExistingPaymentCount = existingPaymentCandidates.length;

    if (existingPaymentCandidates.length > 0) {
      item.possibleExistingPaymentIds = existingPaymentCandidates.map((payment) => payment.id);

      flag(
        item,
        'POSSIBLE_PAYMENT_ALREADY_IN_DATABASE',
        'Hay un pago con mismo alumno, fecha, importe y método compatible; no prueba que sea duplicado, pero debe verificarse.',
      );
    }

    item.classification = item.flags.length === 0 ? 'CANDIDATE_NO_ALERTS' : 'REVIEW';
  }
}

/* =========================================================
 * DETECCIÓN DE MOVIMIENTOS REPETIDOS
 * ========================================================= */

function addDuplicateFlags(items) {
  const quotaItems = items.filter((item) => item.movementType === 'QUOTA');

  const byStudentActivityPeriod = new Map();

  const exactRows = new Map();

  for (const item of quotaItems) {
    const personKey = item.studentId ?? item.dniNormalized ?? 'NO_DNI';

    const classKey = item.classId ?? item.activityKey;

    const periodKey =
      item.periodStart && item.periodEnd
        ? `${item.periodStart}|${item.periodEnd}`
        : (item.periodRaw ?? 'NO_PERIOD');

    const key = `${personKey}|${classKey}|${periodKey}`;

    if (!byStudentActivityPeriod.has(key)) {
      byStudentActivityPeriod.set(key, []);
    }

    byStudentActivityPeriod.get(key).push(item);

    const exactKey = [
      item.dniNormalized,
      item.activityKey,
      item.paymentDateTime,
      item.paymentMethod,
      item.cost,
      item.total,
      item.periodRaw,
    ].join('|');

    if (!exactRows.has(exactKey)) {
      exactRows.set(exactKey, []);
    }

    exactRows.get(exactKey).push(item);
  }

  const duplicateGroups = [];

  for (const [key, group] of byStudentActivityPeriod) {
    if (group.length <= 1) {
      continue;
    }

    for (const item of group) {
      flag(
        item,
        'MULTIPLE_MOVEMENTS_SAME_PERIOD',
        'Hay varios movimientos del mismo alumno, actividad y período; podrían ser pagos parciales o correcciones. No se deben fusionar automáticamente.',
      );

      item.classification = 'REVIEW';
    }

    duplicateGroups.push({
      type: 'MULTIPLE_MOVEMENTS_SAME_PERIOD',
      key,
      count: group.length,

      movementNumbers: group.map((item) => item.movementNumber),

      dnis: [...new Set(group.map((item) => item.dniRaw))].join(', '),

      studentNames: [
        ...new Set(
          group.map(
            (item) => item.studentNameDatabase ?? `${item.lastName} ${item.firstName}`.trim(),
          ),
        ),
      ].join(' / '),

      activities: [...new Set(group.map((item) => item.activityName))].join(' / '),

      periods: [...new Set(group.map((item) => item.periodRaw ?? 'Sin período'))].join(' / '),

      paymentDates: group.map((item) => item.paymentDate).join(', '),

      totals: group.map((item) => item.total).join(', '),
    });
  }

  for (const group of exactRows.values()) {
    if (group.length <= 1) {
      continue;
    }

    for (const item of group) {
      flag(
        item,
        'EXACT_DUPLICATE_ROW',
        'Se encontró más de una fila idéntica en campos clave del movimiento.',
      );

      item.classification = 'REVIEW';
    }

    duplicateGroups.push({
      type: 'EXACT_DUPLICATE_ROW',
      key: group[0].dniNormalized,
      count: group.length,

      movementNumbers: group.map((item) => item.movementNumber),

      dnis: [...new Set(group.map((item) => item.dniRaw))].join(', '),

      studentNames: [
        ...new Set(
          group.map(
            (item) => item.studentNameDatabase ?? `${item.lastName} ${item.firstName}`.trim(),
          ),
        ),
      ].join(' / '),

      activities: [...new Set(group.map((item) => item.activityName))].join(' / '),

      periods: [...new Set(group.map((item) => item.periodRaw ?? 'Sin período'))].join(' / '),

      paymentDates: group.map((item) => item.paymentDate).join(', '),

      totals: group.map((item) => item.total).join(', '),
    });
  }

  return duplicateGroups;
}

/* =========================================================
 * RESUMEN DEL ANÁLISIS
 * ========================================================= */

function summarize(items, footerTotal) {
  const total = (field, subset = items) =>
    roundMoney(subset.reduce((sum, item) => sum + (Number(item[field]) || 0), 0));

  const dates = items
    .map((item) => item.paymentDate)
    .filter(Boolean)
    .sort();

  const typeMap = new Map();

  for (const item of items) {
    if (!typeMap.has(item.movementType)) {
      typeMap.set(item.movementType, {
        movementType: item.movementType,
        label: item.movementTypeLabel,
        count: 0,
        cost: 0,
        total: 0,
      });
    }

    const entry = typeMap.get(item.movementType);

    entry.count += 1;
    entry.cost += Number(item.cost) || 0;
    entry.total += Number(item.total) || 0;
  }

  const byType = [...typeMap.values()].map((entry) => ({
    ...entry,
    cost: roundMoney(entry.cost),
    total: roundMoney(entry.total),
  }));

  const quota = items.filter((item) => item.movementType === 'QUOTA');

  const reportSum = total('total');

  return {
    generatedAt: new Date().toISOString(),
    inputFile: INPUT_FILE,
    sheetName: null,

    reportRange: {
      from: dates[0] ?? null,
      to: dates.at(-1) ?? null,
    },

    counts: {
      allMovements: items.length,

      quotaPayments: quota.length,

      nonQuotaMovements: items.length - quota.length,

      uniqueQuotaDnis: new Set(quota.map((item) => item.dniNormalized).filter(Boolean)).size,

      candidateNoAlerts: quota.filter((item) => item.classification === 'CANDIDATE_NO_ALERTS')
        .length,

      needsReview: quota.filter((item) => item.classification === 'REVIEW').length,

      weeklyQuotaRows: quota.filter((item) => item.periodType === 'WEEKLY').length,

      missingPeriodRows: quota.filter((item) => !item.periodStart || !item.periodEnd).length,

      possibleExistingPayments: quota.filter((item) => (item.possibleExistingPaymentCount ?? 0) > 0)
        .length,

      duplicateGroups: 0,
    },

    amounts: {
      reportRowsTotal: reportSum,
      reportFooterTotal: footerTotal,

      footerDifference: footerTotal === null ? null : roundMoney(reportSum - footerTotal),

      quotaCostTotal: total('cost', quota),

      quotaCollectedTotal: total('total', quota),

      quotaTotalMinusCost: roundMoney(total('total', quota) - total('cost', quota)),
    },

    byType,
  };
}

/* =========================================================
 * PREPARACIÓN DE HOJAS DEL EXCEL
 * ========================================================= */

function makeSummaryRows(summary, duplicateGroups, dbSummary) {
  const rows = [
    {
      Indicador: 'Archivo',
      Valor: path.basename(INPUT_FILE),
    },
    {
      Indicador: 'Período de movimientos desde',
      Valor: summary.reportRange.from ?? 'No identificado',
    },
    {
      Indicador: 'Período de movimientos hasta',
      Valor: summary.reportRange.to ?? 'No identificado',
    },
    {
      Indicador: 'Total de movimientos',
      Valor: summary.counts.allMovements,
    },
    {
      Indicador: 'Pagos de cuota',
      Valor: summary.counts.quotaPayments,
    },
    {
      Indicador: 'Movimientos no correspondientes a cuotas',
      Valor: summary.counts.nonQuotaMovements,
    },
    {
      Indicador: 'DNI únicos en pagos de cuota',
      Valor: summary.counts.uniqueQuotaDnis,
    },
    {
      Indicador: 'Candidatos de cuota sin alertas detectadas',
      Valor: summary.counts.candidateNoAlerts,
    },
    {
      Indicador: 'Pagos de cuota para revisar',
      Valor: summary.counts.needsReview,
    },
    {
      Indicador: 'Períodos semanales',
      Valor: summary.counts.weeklyQuotaRows,
    },
    {
      Indicador: 'Pagos de cuota sin período interpretable',
      Valor: summary.counts.missingPeriodRows,
    },
    {
      Indicador: 'Posibles pagos ya existentes en la app',
      Valor: summary.counts.possibleExistingPayments,
    },
    {
      Indicador: 'Grupos con movimientos repetidos',
      Valor: duplicateGroups.length,
    },
    {
      Indicador: 'Suma de Total de todas las filas',
      Valor: summary.amounts.reportRowsTotal,
    },
    {
      Indicador: 'Total indicado en el pie del reporte',
      Valor: summary.amounts.reportFooterTotal ?? 'No encontrado',
    },
    {
      Indicador: 'Diferencia entre suma de filas y pie',
      Valor: summary.amounts.footerDifference ?? 'No calculable',
    },
    {
      Indicador: 'Costo total de pagos de cuota',
      Valor: summary.amounts.quotaCostTotal,
    },
    {
      Indicador: 'Total cobrado en pagos de cuota',
      Valor: summary.amounts.quotaCollectedTotal,
    },
    {
      Indicador: 'Total cobrado menos costo en pagos de cuota',
      Valor: summary.amounts.quotaTotalMinusCost,
    },
    {
      Indicador: 'Modo de ejecución',
      Valor: reportOnly
        ? 'Solo reporte (sin consultar base de datos)'
        : 'Análisis contra base de datos (solo lectura)',
    },
  ];

  if (dbSummary) {
    rows.push(
      {
        Indicador: 'Alumnos consultados en base de datos',
        Valor: dbSummary.students,
      },
      {
        Indicador: 'Clases consultadas en base de datos',
        Valor: dbSummary.classes,
      },
      {
        Indicador: 'Inscripciones consultadas en base de datos',
        Valor: dbSummary.enrollments,
      },
      {
        Indicador: 'Tarifas consultadas en base de datos',
        Valor: dbSummary.tariffs,
      },
      {
        Indicador: 'Cuotas existentes consultadas',
        Valor: dbSummary.charges,
      },
      {
        Indicador: 'Pagos existentes consultados en el rango',
        Valor: dbSummary.payments,
      },
    );
  }

  return rows;
}

function toWorkbookRows(items) {
  return items.map((item) => ({
    'Fila Excel': item.sourceRow,
    '# Movimiento': item.movementNumber,
    DNI: item.dniRaw,
    'Apellido reporte': item.lastName,
    'Nombre reporte': item.firstName,
    'Alumno en app': item.studentNameDatabase ?? '',
    'DNI normalizado': item.dniNormalized,
    Actividad: item.activityName,
    'Descripción completa': item.activityText,
    'Tipo de movimiento': item.movementTypeLabel,
    'Fecha pago': item.paymentDate,
    'Fecha/hora original': item.paymentDateTime,
    'Método original': item.paymentMethodRaw,
    'Método normalizado': item.paymentMethod,
    'Método soportado': item.paymentMethodSupported,
    Costo: item.cost,
    Total: item.total,
    'Total - costo': item.amountDifference,
    'Período original': item.periodRaw,
    'Inicio período inferido': item.periodStart,
    'Fin período inferido': item.periodEnd,
    'Duración días': item.periodDays,
    'Tipo período': item.periodType,
    'Mes de cuota sugerido': item.chargePeriod,
    'Clase en app': item.classNameDatabase ?? '',
    'Alias de clase usado': item.classAliasUsed ?? false,
    'ID alumno': item.studentId ?? '',
    'ID clase': item.classId ?? '',
    'ID inscripción': item.enrollmentId ?? '',
    'Estado inscripción': item.enrollmentStatus ?? '',
    'Inicio inscripción': item.enrollmentStartDate ?? '',
    'Fin inscripción': item.enrollmentEndDate ?? '',
    'Tarifa en app': item.tariffName ?? '',
    'Importe tarifa': item.tariffAmount ?? null,
    'Vigencia tarifa desde': item.tariffValidFrom ?? '',
    'Vigencia tarifa hasta': item.tariffValidTo ?? '',
    'Estado tarifa': item.tariffStatus ?? '',
    'ID cuota existente': item.existingChargeId ?? '',
    'Estado cuota existente': item.existingChargeStatus ?? '',
    'Importe cuota existente': item.existingChargeFinalAmount ?? null,
    'Cantidad posibles pagos existentes': item.possibleExistingPaymentCount ?? 0,
    Clasificación: item.classification ?? '',
    Alertas: item.flags
      .map((entry) => `${entry.code}${entry.detail ? `: ${entry.detail}` : ''}`)
      .join(' | '),
  }));
}

function toReviewRows(items) {
  return toWorkbookRows(
    items.filter(
      (item) => item.movementType === 'QUOTA' && item.classification !== 'CANDIDATE_NO_ALERTS',
    ),
  );
}

function toOtherMovementRows(items) {
  return toWorkbookRows(items.filter((item) => item.movementType !== 'QUOTA'));
}

/* =========================================================
 * CONSULTA DE DATOS EN PRISMA
 * ========================================================= */

async function readDatabase(prisma) {
  const from = new Date('2026-06-01T00:00:00.000Z');

  const to = new Date('2026-10-24T00:00:00.000Z');

  const [students, classes, enrollments, tariffs, charges, payments] = await Promise.all([
    prisma.student.findMany({
      select: {
        id: true,
        dni: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    }),

    prisma.academyClass.findMany({
      select: {
        id: true,
        name: true,
        status: true,
      },
    }),

    prisma.enrollment.findMany({
      select: {
        id: true,
        studentId: true,
        classId: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    }),

    prisma.tariff.findMany(),

    prisma.monthlyCharge.findMany({
      select: {
        id: true,
        studentId: true,
        enrollmentId: true,
        tariffId: true,
        period: true,
        baseAmount: true,
        finalAmount: true,
        status: true,
      },
    }),

    prisma.payment.findMany({
      where: {
        paidAt: {
          gte: from,
          lt: to,
        },
      },
      select: {
        id: true,
        studentId: true,
        amount: true,
        paidAt: true,
        status: true,
      },
    }),
  ]);

  const tenders = payments.length
    ? await prisma.paymentTender.findMany({
        where: {
          paymentId: {
            in: payments.map((payment) => payment.id),
          },
        },
        select: {
          paymentId: true,
          method: true,
          amount: true,
        },
      })
    : [];

  return {
    students,
    classes,
    enrollments,
    tariffs,
    charges,
    payments,
    tenders,

    summary: {
      students: students.length,
      classes: classes.length,
      enrollments: enrollments.length,
      tariffs: tariffs.length,
      charges: charges.length,
      payments: payments.length,
    },
  };
}

/* =========================================================
 * EJECUCIÓN PRINCIPAL
 * ========================================================= */

async function main() {
  console.log('\n=========================================================');

  console.log(' ANÁLISIS DE MOVIMIENTOS DE CAJA JUNIO-OCTUBRE 2026');

  console.log('=========================================================\n');

  console.log(`📄 Reporte: ${INPUT_FILE}`);

  await fs.access(INPUT_FILE);

  const report = readReport(INPUT_FILE);
  const items = report.items;

  if (!items.length) {
    throw new Error('No se encontraron movimientos con número de fila en el reporte.');
  }

  console.log(`📊 Movimientos leídos: ${items.length}`);

  console.log(`📅 Hoja: ${report.sheetName}; fila de encabezados: ${report.headerRow}`);

  let db = null;
  let dbSummary = null;
  let prisma = null;

  if (reportOnly) {
    for (const item of items) {
      item.flags = [];

      addDataQualityFlags(item);

      item.classification =
        item.movementType === 'QUOTA' ? 'REPORT_ONLY_NOT_MATCHED_TO_DATABASE' : 'OTHER_MOVEMENT';
    }
  } else {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'Falta DATABASE_URL. Ejecutá el script desde la raíz del proyecto y verificá el archivo .env. Para validar solo el Excel, agregá --report-only.',
      );
    }

    prisma = new PrismaClient();
    activePrismaClient = prisma;

    await prisma.$connect();

    db = await readDatabase(prisma);
    dbSummary = db.summary;

    console.log(
      `🔎 Base de datos: ${dbSummary.students} alumnos, ${dbSummary.enrollments} inscripciones, ${dbSummary.tariffs} tarifas, ${dbSummary.charges} cuotas y ${dbSummary.payments} pagos en el rango.`,
    );

    enrichItemsWithDatabase(items, db);
  }

  const duplicateGroups = addDuplicateFlags(items);

  const summary = summarize(items, report.footerTotal);

  summary.sheetName = report.sheetName;

  summary.counts.duplicateGroups = duplicateGroups.length;

  summary.database = dbSummary;
  summary.warnings = [];

  if (
    summary.amounts.footerDifference !== null &&
    Math.abs(summary.amounts.footerDifference) > 0.009
  ) {
    summary.warnings.push(
      `La suma de la columna Total difiere del total impreso al pie por $${summary.amounts.footerDifference.toFixed(2)}.`,
    );
  }

  if (db && !db.tariffs.some((tariff) => tariff.classId || tariff.academyClassId)) {
    summary.warnings.push(
      'La consulta de tarifas no devolvió classId; la validación automática de tarifa por clase puede quedar limitada.',
    );
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const output = {
    ...summary,

    source: {
      file: path.basename(INPUT_FILE),
      sheet: report.sheetName,
      headerRow: report.headerRow,
      footerTotal: report.footerTotal,
    },

    duplicateGroups,
    items,
  };

  await fs.writeFile(OUTPUT_JSON, JSON.stringify(output, null, 2), 'utf8');

  const workbook = utils.book_new();

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(makeSummaryRows(summary, duplicateGroups, dbSummary)),
    'Resumen',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      summary.byType.map((item) => ({
        'Tipo de movimiento': item.label,
        Cantidad: item.count,
        'Suma Costo': item.cost,
        'Suma Total': item.total,
      })),
    ),
    'Por tipo',
  );

  utils.book_append_sheet(workbook, utils.json_to_sheet(toWorkbookRows(items)), 'Movimientos');

  utils.book_append_sheet(workbook, utils.json_to_sheet(toReviewRows(items)), 'Revisar');

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(toOtherMovementRows(items)),
    'Otros movimientos',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      duplicateGroups.map((group) => ({
        Tipo: group.type,
        Cantidad: group.count,
        'Números de movimiento': group.movementNumbers.join(', '),
        DNI: group.dnis,
        Alumnos: group.studentNames,
        Actividades: group.activities,
        Períodos: group.periods,
        'Fechas de pago': group.paymentDates,
        Totales: group.totals,
      })),
    ),
    'Posibles duplicados',
  );

  writeFile(workbook, OUTPUT_XLSX);

  console.log('\n---------------- RESULTADO ----------------');

  console.log(`Movimientos: ${summary.counts.allMovements}`);

  console.log(`Pagos de cuota: ${summary.counts.quotaPayments}`);

  console.log(`Candidatos sin alertas detectadas: ${summary.counts.candidateNoAlerts}`);

  console.log(`Pagos de cuota para revisar: ${summary.counts.needsReview}`);

  console.log(`Otros movimientos: ${summary.counts.nonQuotaMovements}`);

  console.log(`Grupos repetidos: ${duplicateGroups.length}`);

  console.log(
    `Suma de Total: $${summary.amounts.reportRowsTotal?.toLocaleString('es-AR') ?? 'N/D'}`,
  );

  console.log(
    `Total del pie: $${summary.amounts.reportFooterTotal?.toLocaleString('es-AR') ?? 'N/D'}`,
  );

  console.log(`\n📄 JSON: ${OUTPUT_JSON}`);
  console.log(`📊 Excel: ${OUTPUT_XLSX}`);

  console.log('\nEste script no escribe en la base de datos.');

  if (prisma) {
    await prisma.$disconnect();
    activePrismaClient = null;
  }
}

main().catch(async (error) => {
  console.error('\n❌ No se pudo completar el análisis.');

  console.error(error?.stack ?? error);

  if (activePrismaClient) {
    try {
      await activePrismaClient.$disconnect();
    } catch {
      // No se interrumpe el manejo del error original.
    }

    activePrismaClient = null;
  }

  process.exitCode = 1;
});
