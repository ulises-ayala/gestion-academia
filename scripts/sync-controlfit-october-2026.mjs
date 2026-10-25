import fs from 'node:fs/promises';
import path from 'node:path';
import process, { loadEnvFile } from 'node:process';
import xlsx from 'xlsx';
import { PrismaClient } from '@academy/database';

/*
 * Sincronización de octubre 2026 con los reportes de ControlFit (decisiones 155-163).
 *
 * Fases, en este orden (cada una relee la base):
 *   students         altas, DNI provisorios corregidos, reactivaciones y bajas
 *   tariffs          tarifas vigentes desde 01/09/2026 y reactivación de Grupo C. - A.Frank
 *   enrollments      inscripciones faltantes y fechas provisorias 28/08/2026
 *   close-legacy-ended  cierra inscripciones ENDED sin fin que bloquearon re-inscripciones
 *                    (después volver a correr enrollments)
 *   history-tariffs  tarifas históricas de julio/agosto faltantes (requiere análisis actualizado)
 *   debts            cuota de octubre impaga para ListadoAlumnosVencimientoActivo.txt
 *   legacy-students  ex alumnos con DNI provisorio que aparecen pagando: se corrige el DNI
 *   start-before-payment  inicio de inscripción adelantado al período pagado anterior
 *   (ambas sobre el análisis actualizado; después volver a analizar e importar)
 *
 * Simulación:  node scripts/sync-controlfit-october-2026.mjs --phase=students
 * Aplicar:     CONTROLFIT_IMPORT_CONFIRM=<base> node scripts/sync-controlfit-october-2026.mjs --phase=students --apply
 *
 * Escribe mediante la API (API_BASE_URL) con CONTROLFIT_IMPORT_USERNAME/CONTROLFIT_IMPORT_PASSWORD,
 * salvo la corrección de fechas de inicio, que la API no expone y se audita directamente.
 */

try {
  loadEnvFile('.env');
} catch {
  // Las variables pueden venir del entorno.
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const PHASE = args.find((arg) => arg.startsWith('--phase='))?.split('=')[1];
const API = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';
const DATA_DIR = path.resolve('./scripts/data');
const ANALYSIS_FILE = path.resolve('./exports/june-oct-2026-payments-analysis.json');
const MAPPING_FILE = path.resolve('./scripts/controlfit-class-mapping.json');
const TODAY = '2026-10-24';
const PLACEHOLDER_START = '2026-08-28';
const DEFAULT_START = '2026-10-01';
const TARIFF_FROM = '2026-09-01';
const SPECIAL_TARIFFS = {
  'GRUPO C A FRANK': '25000.00',
  'FORMACION DOCENTE EN RITMOS CARIBENOS Y KIZOMBA': '90000.00',
  URBANFLOW: '20000.00',
};
const DEFAULT_TARIFF = '40000.00';
const REACTIVATE_CLASSES = ['Grupo C. - A.Frank'];
const HISTORY_PERIODS = ['2026-07', '2026-08', '2026-09', '2026-10'];
const IMPORT_FROM_PERIOD = '2026-07';
const DEBT_PERIOD = '2026-10';
const DEBT_DUE_DATE = '2026-10-10';

/* ------------------------------ Normalización ------------------------------ */

const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
const nameKey = (value) => normalizeText(value).split(' ').filter(Boolean).sort().join(' ');
const normalizeDni = (value) => String(value ?? '').replace(/\D/g, '');
const isPlaceholderDni = (dni) => /^9000000\d\d$/.test(dni);
const dateOnly = (date) => (date ? date.toISOString().slice(0, 10) : null);
const emptyToNull = (value) => {
  const text = String(value ?? '').trim();
  return !text || text === '-' || /^sin dato$/i.test(text) ? null : text;
};
const parseDate = (value) => {
  const match = String(value ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
};

/* Apellido = primera palabra, más las partículas que la preceden (DE, DEL, LO...). */
const PARTICLES = new Set(['D', 'DE', 'DEL', 'LA', 'LAS', 'LO', 'LOS', 'DI', 'VAN', 'VON']);
const splitName = (fullName) => {
  const words = String(fullName).trim().split(/\s+/);
  let index = 0;
  while (index < words.length - 2 && PARTICLES.has(normalizeText(words[index]))) index += 1;
  return {
    lastName: words.slice(0, index + 1).join(' '),
    firstName: words.slice(index + 1).join(' ') || words[0],
  };
};

/* --------------------------------- Lectura --------------------------------- */

async function readSocios() {
  const files = (await fs.readdir(DATA_DIR)).filter((file) =>
    /^ReporteListaDeSocios.*\.xlsx$/.test(file),
  );
  const socios = new Map();
  for (const file of files) {
    const sheet = xlsx.readFile(path.join(DATA_DIR, file)).Sheets.ReporteListaDeSocios;
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
    const header = rows.findIndex((row) => row[0] === 'DNI/ID');
    for (const row of rows.slice(header + 1)) {
      const dni = normalizeDni(row[0]);
      if (!dni) continue;
      const socio = socios.get(dni) ?? {
        dni,
        rawDni: String(row[0]).trim(),
        fullName: String(row[5]).trim(),
        birthDate: parseDate(row[6]),
        phone: emptyToNull(row[8]),
        email: emptyToNull(row[10]),
        address: emptyToNull(row[12]),
        activities: [],
      };
      const activity = String(row[14] ?? '').trim();
      const due = parseDate(row[15]);
      if (activity && !socio.activities.some((item) => item.activity === activity))
        socio.activities.push({ activity, due });
      socios.set(dni, socio);
    }
  }
  return [...socios.values()];
}

async function readMapping() {
  const mapping = JSON.parse(await fs.readFile(MAPPING_FILE, 'utf8'));
  return new Map(
    Object.entries(mapping.aliases).map(([activity, entry]) => [
      normalizeText(activity),
      Array.isArray(entry) ? { names: entry, fallback: null } : entry,
    ]),
  );
}

async function readAnalysisItems() {
  try {
    return JSON.parse(await fs.readFile(ANALYSIS_FILE, 'utf8')).items;
  } catch {
    return [];
  }
}

async function readDatabase(prisma) {
  const [students, classes, tariffs] = await Promise.all([
    prisma.student.findMany({
      include: {
        enrollments: { select: { id: true, classId: true, status: true, startDate: true } },
      },
    }),
    prisma.academyClass.findMany({ select: { id: true, name: true, status: true } }),
    prisma.tariff.findMany({
      select: { id: true, classId: true, validFrom: true, validTo: true, status: true },
    }),
  ]);
  return { students, classes, tariffs };
}

/* ------------------------------ Resolución -------------------------------- */

function classResolver(classes, mapping) {
  const byName = new Map();
  for (const academicClass of classes)
    byName.set(normalizeText(academicClass.name), [
      ...(byName.get(normalizeText(academicClass.name)) ?? []),
      academicClass,
    ]);
  const find = (name) => byName.get(normalizeText(name)) ?? [];

  return (activity, enrolledClassIds = new Set()) => {
    const exact = find(activity);
    if (exact.length === 1) return exact[0];
    const alias = mapping.get(normalizeText(activity));
    if (!alias || alias.names.length === 0) return null;
    const candidates = alias.names.flatMap(find);
    if (candidates.length === 1) return candidates[0];
    const enrolled = candidates.filter(({ id }) => enrolledClassIds.has(id));
    if (enrolled.length === 1) return enrolled[0];
    return alias.fallback ? (find(alias.fallback)[0] ?? null) : null;
  };
}

/* Alumno de la base para un socio: por DNI, o por nombre (DNI provisorio o mal cargado). */
function studentMatcher(students) {
  const byDni = new Map(students.map((student) => [normalizeDni(student.dni), student]));
  const byName = new Map();
  for (const student of students) {
    const key = nameKey(`${student.lastName} ${student.firstName}`);
    byName.set(key, [...(byName.get(key) ?? []), student]);
  }
  return (socio) => {
    const direct = byDni.get(socio.dni);
    if (direct) return { student: direct, match: 'DNI' };
    const named = byName.get(nameKey(socio.fullName)) ?? [];
    const placeholder = named.filter(({ dni }) => isPlaceholderDni(dni));
    if (placeholder.length === 1) return { student: placeholder[0], match: 'PLACEHOLDER' };
    if (named.length === 1) return { student: named[0], match: 'NAME' };
    return { student: null, match: named.length > 1 ? 'AMBIGUOUS_NAME' : 'NONE' };
  };
}

/* ----------------------------------- API ---------------------------------- */

let cookie = null;
async function api(method, url, body) {
  if (!cookie) {
    const response = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.CONTROLFIT_IMPORT_USERNAME,
        password: process.env.CONTROLFIT_IMPORT_PASSWORD,
      }),
    });
    if (!response.ok) throw new Error(`No se pudo iniciar sesión en la API (${response.status}).`);
    cookie = response.headers.get('set-cookie').split(';')[0];
  }
  const response = await fetch(`${API}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok)
    return {
      ok: false,
      error: payload?.code ?? payload?.error?.code ?? response.status,
      message: payload?.message ?? payload?.error?.message,
    };
  return { ok: true, data: payload };
}

/* Ejecuta la acción sólo con --apply; siempre la registra en el reporte. */
async function perform(actions, action, run) {
  if (!APPLY) {
    actions.push({ ...action, result: 'PLANNED' });
    return null;
  }
  const outcome = await run();
  actions.push({
    ...action,
    result: outcome.ok ? 'DONE' : 'FAILED',
    ...(outcome.ok ? {} : { error: outcome.error, message: outcome.message }),
  });
  return outcome.ok ? outcome.data : null;
}

/* ---------------------------------- Fases --------------------------------- */

async function studentsPhase(prisma, actions) {
  const socios = await readSocios();
  const { students } = await readDatabase(prisma);
  const match = studentMatcher(students);
  const matchedIds = new Set();

  for (const socio of socios) {
    const { student, match: kind } = match(socio);
    const label = { dni: socio.dni, name: socio.fullName };
    if (student) matchedIds.add(student.id);
    if (kind === 'AMBIGUOUS_NAME') {
      actions.push({ type: 'REVIEW', ...label, reason: 'Más de un alumno con el mismo nombre.' });
      continue;
    }
    if (kind === 'NAME') {
      actions.push({
        type: 'DNI_MISMATCH',
        ...label,
        databaseDni: student.dni,
        reason: 'Mismo nombre con otro DNI; se conserva el de la base.',
      });
    }
    if (kind === 'PLACEHOLDER') {
      await perform(
        actions,
        { type: 'FIX_PLACEHOLDER_DNI', ...label, previousDni: student.dni },
        () => api('PATCH', `/students/${student.id}`, { dni: socio.dni, status: 'ACTIVE' }),
      );
      continue;
    }
    if (student && student.status !== 'ACTIVE') {
      await perform(actions, { type: 'REACTIVATE', ...label }, () =>
        api('POST', `/students/${student.id}/reactivate`),
      );
      continue;
    }
    if (!student) {
      const { firstName, lastName } = splitName(socio.fullName);
      await perform(actions, { type: 'CREATE', ...label, lastName, firstName }, () =>
        api('POST', '/students', {
          dni: socio.dni,
          firstName,
          lastName,
          birthDate: socio.birthDate,
          phone: socio.phone,
          email: socio.email,
          address: socio.address,
        }),
      );
    }
  }

  for (const student of students) {
    if (student.status !== 'ACTIVE' || matchedIds.has(student.id)) continue;
    const label = { dni: student.dni, name: `${student.lastName} ${student.firstName}` };
    if (student.enrollments.some(({ status }) => status === 'ACTIVE')) {
      actions.push({ type: 'KEEP_NOT_IN_FILE', ...label, reason: 'Tiene inscripciones activas.' });
      continue;
    }
    await perform(actions, { type: 'DEACTIVATE', ...label }, () =>
      api('DELETE', `/students/${student.id}`),
    );
  }
}

async function tariffsPhase(prisma, actions) {
  const { classes, tariffs } = await readDatabase(prisma);
  for (const academicClass of classes) {
    if (academicClass.status === 'ACTIVE' || !REACTIVATE_CLASSES.includes(academicClass.name))
      continue;
    await perform(actions, { type: 'REACTIVATE_CLASS', class: academicClass.name }, () =>
      api('POST', `/classes/${academicClass.id}/reactivate`),
    );
    academicClass.status = 'ACTIVE';
  }
  for (const academicClass of classes) {
    if (academicClass.status !== 'ACTIVE') continue;
    if (
      tariffs.some(
        (tariff) =>
          tariff.classId === academicClass.id && dateOnly(tariff.validFrom) >= TARIFF_FROM,
      )
    )
      continue;
    const amount = SPECIAL_TARIFFS[normalizeText(academicClass.name)] ?? DEFAULT_TARIFF;
    const name = `${academicClass.name} - desde 09/2026 - $${Number(amount).toLocaleString('es-AR')}`;
    await perform(
      actions,
      { type: 'CREATE_TARIFF', class: academicClass.name, amount, validFrom: TARIFF_FROM },
      () =>
        api('POST', '/tariffs', {
          classId: academicClass.id,
          name,
          amount,
          validFrom: TARIFF_FROM,
        }),
    );
  }
}

/* Inicio del primer período abonado en ControlFit para el alumno y la clase. */
function firstPaidPeriods(items, resolve, enrolledByDni) {
  const first = new Map();
  for (const item of items) {
    if (item.movementType !== 'QUOTA' || !item.periodStart) continue;
    const academicClass = resolve(item.activityName, enrolledByDni.get(item.dniNormalized));
    if (!academicClass) continue;
    const key = `${item.dniNormalized}|${academicClass.id}`;
    if (!first.has(key) || item.periodStart < first.get(key)) first.set(key, item.periodStart);
  }
  return first;
}

async function enrollmentsPhase(prisma, actions, actorId) {
  const socios = await readSocios();
  const { students, classes } = await readDatabase(prisma);
  const resolve = classResolver(classes, await readMapping());
  const match = studentMatcher(students);
  const enrolledByDni = new Map(
    students.map((student) => [
      normalizeDni(student.dni),
      new Set(
        student.enrollments
          .filter(({ status }) => status === 'ACTIVE')
          .map(({ classId }) => classId),
      ),
    ]),
  );
  const firstPaid = firstPaidPeriods(await readAnalysisItems(), resolve, enrolledByDni);
  const firstPaidFor = (dnis, classId) =>
    dnis
      .map((dni) => firstPaid.get(`${dni}|${classId}`))
      .filter(Boolean)
      .sort()[0] ?? null;

  for (const socio of socios) {
    const { student } = match(socio);
    if (!student) {
      actions.push({
        type: 'REVIEW',
        dni: socio.dni,
        name: socio.fullName,
        reason: 'Alumno inexistente: correr antes la fase students.',
      });
      continue;
    }
    const enrolled = enrolledByDni.get(normalizeDni(student.dni)) ?? new Set();
    // Las actividades con alias ambiguo se resuelven después de crear las demás inscripciones.
    const ordered = [...socio.activities].sort(
      (a, b) => Number(/puchini/i.test(a.activity)) - Number(/puchini/i.test(b.activity)),
    );
    for (const { activity } of ordered) {
      const label = { dni: student.dni, name: socio.fullName, activity };
      const academicClass = resolve(activity, enrolled);
      if (!academicClass) {
        actions.push({ type: 'REVIEW', ...label, reason: 'Actividad sin clase equivalente.' });
        continue;
      }
      if (enrolled.has(academicClass.id)) continue;
      const startDate =
        firstPaidFor([socio.dni, normalizeDni(student.dni)], academicClass.id) ?? DEFAULT_START;
      await perform(
        actions,
        { type: 'CREATE_ENROLLMENT', ...label, class: academicClass.name, startDate },
        () =>
          api('POST', '/enrollments', {
            studentId: student.id,
            classId: academicClass.id,
            startDate,
          }),
      );
      enrolled.add(academicClass.id);
    }
  }

  const classNames = new Map(classes.map(({ id, name }) => [id, name]));
  for (const student of students) {
    for (const enrollment of student.enrollments) {
      if (dateOnly(enrollment.startDate) !== PLACEHOLDER_START) continue;
      const startDate = firstPaidFor([normalizeDni(student.dni)], enrollment.classId);
      if (!startDate || startDate >= PLACEHOLDER_START) continue;
      await perform(
        actions,
        {
          type: 'FIX_START_DATE',
          dni: student.dni,
          name: `${student.lastName} ${student.firstName}`,
          class: classNames.get(enrollment.classId),
          previous: PLACEHOLDER_START,
          startDate,
        },
        async () => {
          await prisma.$transaction([
            prisma.enrollment.update({
              where: { id: enrollment.id },
              data: { startDate: new Date(`${startDate}T00:00:00.000Z`) },
            }),
            prisma.auditLog.create({
              data: {
                actorUserId: actorId,
                action: 'CORRECTION',
                entityType: 'ENROLLMENT',
                entityId: enrollment.id,
                reason:
                  'Fecha de inicio provisoria reemplazada por el primer período abonado en ControlFit',
                before: { startDate: PLACEHOLDER_START },
                after: { startDate },
              },
            }),
          ]);
          return { ok: true };
        },
      );
    }
  }
}

/*
 * Inscripciones legacy ENDED sin fecha de fin bloquean la re-inscripción por superposición.
 * Toma los rechazos del último reporte de enrollments y cierra la inscripción con la que
 * chocan el día anterior al nuevo inicio.
 */
async function closeLegacyEndedPhase(prisma, actions, actorId) {
  const report = JSON.parse(
    await fs.readFile(path.resolve('./exports/controlfit-sync-enrollments.json'), 'utf8'),
  );
  const conflicts = report.actions.filter(
    ({ result, error }) => result === 'FAILED' && error === 'ENROLLMENT_SCHEDULE_CONFLICT',
  );
  for (const conflict of conflicts) {
    const className = conflict.message.match(/inscripto en (.+), que se superpone/)?.[1];
    const student = await prisma.student.findUnique({ where: { dni: conflict.dni } });
    const legacy = await prisma.enrollment.findMany({
      where: { studentId: student?.id, status: 'ENDED', endDate: null, class: { name: className } },
    });
    const day = new Date(`${conflict.startDate}T00:00:00.000Z`);
    day.setUTCDate(day.getUTCDate() - 1);
    const endDate = dateOnly(day);
    const label = {
      dni: conflict.dni,
      name: conflict.name,
      class: className,
      newClass: conflict.class,
      endDate,
    };
    if (legacy.length !== 1 || dateOnly(legacy[0].startDate) > endDate) {
      actions.push({
        type: 'REVIEW',
        ...label,
        reason: `Se esperaba una inscripción ENDED sin fin; hay ${legacy.length}.`,
      });
      continue;
    }
    await perform(actions, { type: 'CLOSE_LEGACY_ENDED', ...label }, async () => {
      await prisma.$transaction([
        prisma.enrollment.update({
          where: { id: legacy[0].id },
          data: { endDate: new Date(`${endDate}T00:00:00.000Z`) },
        }),
        prisma.auditLog.create({
          data: {
            actorUserId: actorId,
            action: 'CORRECTION',
            entityType: 'ENROLLMENT',
            entityId: legacy[0].id,
            reason:
              'Inscripción finalizada sin fecha de fin: se cierra el día anterior a la nueva inscripción',
            before: { endDate: null },
            after: { endDate },
          },
        }),
      ]);
      return { ok: true };
    });
  }
}

/* Pagos de alumnos no encontrados que coinciden por nombre con un alumno de DNI provisorio. */
async function legacyStudentsPhase(prisma, actions) {
  const items = (await readAnalysisItems()).filter(
    (item) =>
      item.chargePeriod >= IMPORT_FROM_PERIOD &&
      item.flags.some(({ code }) => code === 'STUDENT_NOT_FOUND'),
  );
  const { students } = await readDatabase(prisma);
  const done = new Set();
  for (const item of items) {
    if (done.has(item.dniNormalized)) continue;
    done.add(item.dniNormalized);
    const name = `${item.lastName} ${item.firstName}`;
    const placeholders = students.filter(
      (student) =>
        isPlaceholderDni(student.dni) &&
        nameKey(`${student.lastName} ${student.firstName}`) === nameKey(name),
    );
    if (placeholders.length !== 1) {
      actions.push({
        type: 'REVIEW',
        dni: item.dniNormalized,
        name,
        reason: 'Sin alumno provisorio único con ese nombre.',
      });
      continue;
    }
    await perform(
      actions,
      {
        type: 'FIX_PLACEHOLDER_DNI',
        dni: item.dniNormalized,
        name,
        previousDni: placeholders[0].dni,
      },
      () => api('PATCH', `/students/${placeholders[0].id}`, { dni: item.dniNormalized }),
    );
  }
}

/* Inscripciones que empiezan después de un período que el alumno ya pagó en ControlFit. */
async function startBeforePaymentPhase(prisma, actions, actorId) {
  const items = (await readAnalysisItems()).filter(
    (item) =>
      item.chargePeriod >= IMPORT_FROM_PERIOD &&
      item.enrollmentId &&
      item.flags.some(({ code }) => code === 'PERIOD_BEFORE_ENROLLMENT'),
  );
  const earliest = new Map();
  for (const item of items)
    if (
      !earliest.has(item.enrollmentId) ||
      item.periodStart < earliest.get(item.enrollmentId).periodStart
    )
      earliest.set(item.enrollmentId, item);
  for (const [enrollmentId, item] of earliest) {
    const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    const previous = dateOnly(enrollment.startDate);
    if (item.periodStart >= previous) continue;
    await perform(
      actions,
      {
        type: 'FIX_START_DATE',
        dni: item.dniNormalized,
        name: `${item.lastName} ${item.firstName}`,
        class: item.classNameDatabase,
        previous,
        startDate: item.periodStart,
      },
      async () => {
        await prisma.$transaction([
          prisma.enrollment.update({
            where: { id: enrollmentId },
            data: { startDate: new Date(`${item.periodStart}T00:00:00.000Z`) },
          }),
          prisma.auditLog.create({
            data: {
              actorUserId: actorId,
              action: 'CORRECTION',
              entityType: 'ENROLLMENT',
              entityId: enrollmentId,
              reason: 'Inicio adelantado al primer período abonado en ControlFit',
              before: { startDate: previous },
              after: { startDate: item.periodStart },
            },
          }),
        ]);
        return { ok: true };
      },
    );
  }
}

async function historyTariffsPhase(prisma, actions) {
  const items = await readAnalysisItems();
  const { classes } = await readDatabase(prisma);
  const classNames = new Map(classes.map(({ id, name }) => [id, name]));
  const groups = new Map();
  for (const item of items) {
    if (!item.classId || !HISTORY_PERIODS.includes(item.chargePeriod)) continue;
    if (!item.flags.some(({ code }) => code === 'TARIFF_NOT_FOUND')) continue;
    const key = `${item.classId}|${item.chargePeriod}`;
    groups.set(key, [...(groups.get(key) ?? []), item.cost]);
  }
  for (const [key, costs] of groups) {
    const [classId, period] = key.split('|');
    const counts = new Map();
    for (const cost of costs) counts.set(cost, (counts.get(cost) ?? 0) + 1);
    const amount = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    const [year, month] = period.split('-').map(Number);
    const validFrom = `${period}-01`;
    const validTo = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const className = classNames.get(classId);
    const name = `Histórica - ${className} - ${period} - $${amount.toLocaleString('es-AR')}`;
    await perform(
      actions,
      {
        type: 'CREATE_HISTORICAL_TARIFF',
        class: className,
        period,
        amount,
        movements: costs.length,
        costs: [...counts].map(([cost, count]) => `${cost}×${count}`).join(', '),
      },
      async () => {
        const created = await api('POST', '/tariffs', {
          classId,
          name,
          amount: amount.toFixed(2),
          validFrom,
          validTo,
        });
        if (!created.ok) return created;
        return api('PATCH', `/tariffs/${created.data.id}`, { status: 'INACTIVE' });
      },
    );
  }
}

async function debtsPhase(prisma, actions) {
  const names = (
    await fs.readFile(path.join(DATA_DIR, 'ListadoAlumnosVencimientoActivo.txt'), 'utf8')
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const socios = await readSocios();
  const { students, classes, tariffs } = await readDatabase(prisma);
  const resolve = classResolver(classes, await readMapping());
  const match = studentMatcher(students);
  const sociosByName = new Map(socios.map((socio) => [nameKey(socio.fullName), socio]));
  const charges = await prisma.monthlyCharge.findMany({
    where: { period: new Date(`${DEBT_PERIOD}-01T00:00:00.000Z`) },
    select: { enrollmentId: true },
  });
  const charged = new Set(charges.map(({ enrollmentId }) => enrollmentId));

  for (const name of names) {
    const socio = sociosByName.get(nameKey(name));
    const student = socio ? match(socio).student : null;
    if (!socio || !student) {
      actions.push({
        type: 'REVIEW',
        name,
        reason: socio ? 'Alumno inexistente en la base.' : 'No figura en los reportes de socios.',
      });
      continue;
    }
    const active = student.enrollments.filter(({ status }) => status === 'ACTIVE');
    const enrolled = new Set(active.map(({ classId }) => classId));
    for (const { activity, due } of socio.activities) {
      const label = { dni: student.dni, name, activity, due };
      if (!due || due > TODAY) continue;
      const academicClass = resolve(activity, enrolled);
      const enrollment =
        academicClass && active.find(({ classId }) => classId === academicClass.id);
      if (!enrollment) {
        actions.push({
          type: 'REVIEW',
          ...label,
          reason: 'Sin inscripción activa para la actividad.',
        });
        continue;
      }
      if (charged.has(enrollment.id)) {
        actions.push({
          type: 'SKIP_CHARGE_EXISTS',
          ...label,
          reason: 'Ya existe la cuota de octubre (importada como pagada).',
        });
        continue;
      }
      const tariff = tariffs.find(
        (item) =>
          item.classId === academicClass.id &&
          item.status === 'ACTIVE' &&
          dateOnly(item.validFrom) <= `${DEBT_PERIOD}-01` &&
          (!item.validTo || dateOnly(item.validTo) >= `${DEBT_PERIOD}-01`),
      );
      if (!tariff) {
        actions.push({
          type: 'REVIEW',
          ...label,
          reason: 'La clase no tiene tarifa activa para octubre.',
        });
        continue;
      }
      await perform(
        actions,
        {
          type: 'CREATE_PENDING_CHARGE',
          ...label,
          class: academicClass.name,
          period: DEBT_PERIOD,
          dueDate: DEBT_DUE_DATE,
        },
        () =>
          api('POST', '/monthly-charges', {
            enrollmentId: enrollment.id,
            tariffId: tariff.id,
            period: DEBT_PERIOD,
            dueDate: DEBT_DUE_DATE,
          }),
      );
      charged.add(enrollment.id);
    }
  }
}

const PHASES = {
  students: studentsPhase,
  tariffs: tariffsPhase,
  enrollments: enrollmentsPhase,
  'close-legacy-ended': closeLegacyEndedPhase,
  'legacy-students': legacyStudentsPhase,
  'start-before-payment': startBeforePaymentPhase,
  'history-tariffs': historyTariffsPhase,
  debts: debtsPhase,
};

async function main() {
  if (!PHASES[PHASE]) throw new Error(`Indicá --phase=${Object.keys(PHASES).join('|')}.`);
  const databaseUrl = process.env.DATABASE_URL;
  const target = databaseUrl ? decodeURIComponent(new URL(databaseUrl).pathname.slice(1)) : null;
  if (!target) throw new Error('Falta DATABASE_URL.');
  if (APPLY && process.env.CONTROLFIT_IMPORT_CONFIRM !== target)
    throw new Error(`Para escribir en "${target}" definí CONTROLFIT_IMPORT_CONFIRM=${target}.`);

  const prisma = new PrismaClient();
  try {
    const actor = await prisma.adminUser.findUnique({
      where: { username: process.env.CONTROLFIT_IMPORT_USERNAME ?? '' },
      select: { id: true, status: true },
    });
    if (!actor || actor.status !== 'ACTIVE')
      throw new Error('CONTROLFIT_IMPORT_USERNAME no corresponde a un usuario activo.');

    const actions = [];
    await PHASES[PHASE](prisma, actions, actor.id);

    const summary = {};
    for (const { type, result } of actions)
      summary[`${type}:${result ?? '-'}`] = (summary[`${type}:${result ?? '-'}`] ?? 0) + 1;
    const report = path.resolve(
      `./exports/controlfit-sync-${PHASE}${APPLY ? '' : '-dry-run'}.json`,
    );
    await fs.mkdir(path.dirname(report), { recursive: true });
    await fs.writeFile(
      report,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          phase: PHASE,
          apply: APPLY,
          database: target,
          summary,
          actions,
        },
        null,
        2,
      ),
      'utf8',
    );
    console.log(`Fase ${PHASE} (${APPLY ? 'APLICADA' : 'simulación'}) en ${target}`);
    console.log(summary);
    console.log(`📄 ${report}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('\n❌ No se pudo completar la sincronización.');
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
