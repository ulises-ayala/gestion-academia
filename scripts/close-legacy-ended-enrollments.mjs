import fs from 'node:fs/promises';
import path from 'node:path';
import process, { loadEnvFile } from 'node:process';
import { PrismaClient } from '@academy/database';

/*
 * Inscripciones legacy ENDED sin fecha de fin (decisión 201): se cierran el último día del último
 * período cobrado (cuota mensual PAID o PARTIAL) de esa inscripción, con auditoría CORRECTION.
 * Quedan para revisión, sin cambios, las que no tienen cuotas cobradas o cuyo cierre se superpone
 * con otra inscripción a la misma clase.
 *
 * Simulación:  node scripts/close-legacy-ended-enrollments.mjs
 * Aplicar:     CONTROLFIT_IMPORT_CONFIRM=<base> node scripts/close-legacy-ended-enrollments.mjs --apply
 *
 * La auditoría se registra a nombre de CONTROLFIT_IMPORT_USERNAME.
 */

try {
  loadEnvFile('.env');
} catch {
  // Las variables pueden venir del entorno.
}

const APPLY = process.argv.slice(2).includes('--apply');
const REASON =
  'Inscripción finalizada sin fecha de fin: se cierra el último día del último período cobrado';

const dateOnly = (date) => (date ? date.toISOString().slice(0, 10) : null);
const lastDayOfMonth = (period) =>
  new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 0));

async function plan(prisma) {
  const legacy = await prisma.enrollment.findMany({
    where: { status: 'ENDED', endDate: null },
    include: {
      student: { select: { dni: true, firstName: true, lastName: true } },
      class: { select: { name: true } },
      monthlyCharges: {
        where: { kind: 'MONTHLY', status: { in: ['PAID', 'PARTIAL'] } },
        select: { period: true },
        orderBy: { period: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ studentId: 'asc' }, { startDate: 'asc' }],
  });
  const items = [];
  for (const enrollment of legacy) {
    const label = {
      enrollmentId: enrollment.id,
      dni: enrollment.student.dni,
      name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
      class: enrollment.class.name,
      startDate: dateOnly(enrollment.startDate),
    };
    const lastPeriod = enrollment.monthlyCharges[0]?.period;
    if (!lastPeriod) {
      items.push({ type: 'REVIEW', ...label, reason: 'No tiene cuotas cobradas.' });
      continue;
    }
    const endDate = lastDayOfMonth(lastPeriod);
    const lastPaidPeriod = dateOnly(lastPeriod).slice(0, 7);
    if (endDate < enrollment.startDate) {
      items.push({
        type: 'REVIEW',
        ...label,
        lastPaidPeriod,
        reason: 'El último período cobrado termina antes del inicio de la inscripción.',
      });
      continue;
    }
    const overlapping = await prisma.enrollment.findFirst({
      where: {
        id: { not: enrollment.id },
        studentId: enrollment.studentId,
        classId: enrollment.classId,
        startDate: { gte: enrollment.startDate, lte: endDate },
      },
      select: { id: true, startDate: true },
    });
    if (overlapping) {
      items.push({
        type: 'REVIEW',
        ...label,
        lastPaidPeriod,
        reason: `Otra inscripción a la clase empieza el ${dateOnly(overlapping.startDate)}, antes del cierre.`,
      });
      continue;
    }
    items.push({ type: 'CLOSE', ...label, lastPaidPeriod, endDate: dateOnly(endDate) });
  }
  return items;
}

async function close(prisma, item, actorId) {
  await prisma.$transaction(async (tx) => {
    // Relee dentro de la transacción: si alguien la reactivó o cerró, no se toca.
    const { count } = await tx.enrollment.updateMany({
      where: { id: item.enrollmentId, status: 'ENDED', endDate: null },
      data: { endDate: new Date(`${item.endDate}T00:00:00.000Z`) },
    });
    if (count !== 1) throw new Error('La inscripción cambió desde la simulación.');
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        action: 'CORRECTION',
        entityType: 'ENROLLMENT',
        entityId: item.enrollmentId,
        reason: REASON,
        before: { endDate: null },
        after: { endDate: item.endDate },
        metadata: {
          className: item.class,
          studentName: item.name,
          lastPaidPeriod: item.lastPaidPeriod,
        },
      },
    });
  });
}

async function main() {
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
    for (const item of await plan(prisma)) {
      if (item.type !== 'CLOSE' || !APPLY) {
        actions.push({ ...item, result: item.type === 'CLOSE' ? 'PLANNED' : null });
        continue;
      }
      try {
        await close(prisma, item, actor.id);
        actions.push({ ...item, result: 'DONE' });
      } catch (error) {
        actions.push({ ...item, result: 'FAILED', message: error.message });
      }
    }

    const summary = {};
    for (const { type, result } of actions)
      summary[`${type}:${result ?? '-'}`] = (summary[`${type}:${result ?? '-'}`] ?? 0) + 1;
    const report = path.resolve(
      `./exports/close-legacy-ended-enrollments${APPLY ? '' : '-dry-run'}.json`,
    );
    await fs.mkdir(path.dirname(report), { recursive: true });
    await fs.writeFile(
      report,
      JSON.stringify(
        { generatedAt: new Date().toISOString(), apply: APPLY, database: target, summary, actions },
        null,
        2,
      ),
      'utf8',
    );
    console.log(`Inscripciones legacy sin fin (${APPLY ? 'APLICADO' : 'simulación'}) en ${target}`);
    console.log(summary);
    console.log(`📄 ${report}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('\n❌ No se pudieron cerrar las inscripciones legacy.');
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
