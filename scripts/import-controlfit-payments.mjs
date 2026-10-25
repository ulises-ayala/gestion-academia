import fs from 'node:fs/promises';
import path from 'node:path';
import process, { loadEnvFile } from 'node:process';
import xlsx from 'xlsx';
import { Prisma, PrismaClient } from '@academy/database';
import { centsToDecimal, planImport } from './lib/controlfit-payment-import.mjs';

/*
 * Importación histórica de cobros de cuota de ControlFit.
 *
 * Entrada: el JSON generado por scripts/analyze-june-2026-payments.mjs
 * (volver a ejecutarlo después de cambiar scripts/controlfit-class-mapping.json).
 *
 * Por cada movimiento importable crea, en una transacción:
 * - la cuota mensual de la inscripción, PAID, con el costo de ControlFit como base;
 * - sus ajustes (descuento histórico o recargo por mora);
 * - un pago CONTROLFIT_IMPORT con la fecha real, un medio y una imputación;
 * - un registro de auditoría.
 * No crea movimientos de caja ni turnos. Es idempotente por legacyReference.
 *
 * Simulación (no escribe):
 *   node scripts/import-controlfit-payments.mjs
 *
 * Aplicar:
 *   CONTROLFIT_IMPORT_CONFIRM=<nombre de la base> node scripts/import-controlfit-payments.mjs --apply
 *
 * Requiere CONTROLFIT_IMPORT_USERNAME: usuario administrativo responsable de los pagos.
 */

try {
  loadEnvFile('.env');
} catch {
  // Las variables pueden venir del entorno.
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FROM_PERIOD = args.find((arg) => arg.startsWith('--from-period='))?.split('=')[1] ?? null;
const ANALYSIS_FILE = path.resolve(
  args.find((arg) => !arg.startsWith('--')) ?? './exports/june-oct-2026-payments-analysis.json',
);
const OUTPUT_DIR = path.resolve('./exports');
const REPORT_JSON = path.join(OUTPUT_DIR, 'controlfit-payment-import-report.json');
const REPORT_XLSX = path.join(OUTPUT_DIR, 'controlfit-payment-import-report.xlsx');
const TIME_ZONE = process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires';
const IMPORT_REASON = 'Importación histórica desde ControlFit';

const databaseName = (url) => {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, '')) || null;
  } catch {
    return null;
  }
};

const databaseHost = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return '?';
  }
};

/* Revalida contra la base lo que el análisis resolvió en su momento. */
async function checkRecord(prisma, record) {
  const payment = await prisma.payment.findUnique({
    where: { legacyReference: record.legacyReference },
    select: { id: true },
  });
  if (payment) return 'ALREADY_IMPORTED';
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: record.enrollmentId },
    select: { studentId: true, classId: true },
  });
  const tariff = await prisma.tariff.findUnique({
    where: { id: record.tariffId },
    select: { id: true },
  });
  const charge = await prisma.monthlyCharge.findUnique({
    where: {
      enrollmentId_period: {
        enrollmentId: record.enrollmentId,
        period: new Date(`${record.period}T00:00:00.000Z`),
      },
    },
    select: { id: true },
  });
  if (
    !enrollment ||
    enrollment.studentId !== record.studentId ||
    enrollment.classId !== record.classId
  )
    return 'ENROLLMENT_CHANGED';
  if (!tariff) return 'TARIFF_NOT_FOUND';
  if (charge) return 'CHARGE_ALREADY_EXISTS';
  return null;
}

const adjustmentData = (adjustment, actorId) => {
  const amount = new Prisma.Decimal(centsToDecimal(adjustment.amountCents));
  const delta = adjustment.type === 'HISTORICAL_DISCOUNT' ? amount.negated() : amount;
  return {
    type: adjustment.type,
    calculation: 'FIXED',
    configuredValue: amount,
    effectiveAmount: amount,
    studentAmountDelta: delta,
    settlementBaseDelta: delta,
    createdByUserId: actorId,
    reason: adjustment.reason,
  };
};

async function importRecord(prisma, record, actorId, sourceFile) {
  return prisma.$transaction(async (tx) => {
    // Mismo lock por alumno que usa el cobro de caja.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${record.studentId}))`;
    const conflict = await checkRecord(tx, record);
    if (conflict) return conflict;

    const charge = await tx.monthlyCharge.create({
      data: {
        studentId: record.studentId,
        enrollmentId: record.enrollmentId,
        tariffId: record.tariffId,
        period: new Date(`${record.period}T00:00:00.000Z`),
        baseAmount: record.baseAmount,
        discountAmount: record.discountAmount,
        finalAmount: record.finalAmount,
        dueDate: new Date(`${record.dueDate}T00:00:00.000Z`),
        status: 'PAID',
        adjustments: { create: record.adjustments.map((item) => adjustmentData(item, actorId)) },
      },
    });
    const payment = await tx.payment.create({
      data: {
        studentId: record.studentId,
        amount: record.amount,
        status: 'CONFIRMED',
        origin: 'CONTROLFIT_IMPORT',
        legacyReference: record.legacyReference,
        paidAt: new Date(record.paidAt),
        createdByUserId: actorId,
        tenders: { create: [{ method: record.method, amount: record.amount }] },
        allocations: { create: [{ monthlyChargeId: charge.id, amount: record.amount }] },
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        action: 'CREATE',
        entityType: 'PAYMENT',
        entityId: payment.id,
        reason: IMPORT_REASON,
        after: { status: 'CONFIRMED', amount: record.amount, paidAt: record.paidAt },
        metadata: {
          origin: 'CONTROLFIT_IMPORT',
          legacyReference: record.legacyReference,
          sourceFile,
          sourceRow: record.sourceRow,
          monthlyChargeId: charge.id,
        },
      },
    });
    return 'IMPORTED';
  });
}

const reportRow = (item, extra) => ({
  Fila: item.sourceRow,
  DNI: item.dniRaw,
  Alumno: item.studentNameDatabase ?? `${item.lastName} ${item.firstName}`.trim(),
  Actividad: item.activityName,
  Clase: item.classNameDatabase ?? '',
  Período: item.periodRaw ?? '',
  'Fecha de pago': item.paymentDate,
  Medio: item.paymentMethodRaw,
  Costo: item.cost,
  Total: item.total,
  ...extra,
});

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Falta DATABASE_URL.');
  const username = process.env.CONTROLFIT_IMPORT_USERNAME;
  if (!username)
    throw new Error('Falta CONTROLFIT_IMPORT_USERNAME (usuario responsable de los pagos).');
  const target = databaseName(databaseUrl);
  if (APPLY && process.env.CONTROLFIT_IMPORT_CONFIRM !== target)
    throw new Error(
      `Para escribir en "${target}" definí CONTROLFIT_IMPORT_CONFIRM=${target}. Sin --apply el script solo simula.`,
    );

  const analysis = JSON.parse(await fs.readFile(ANALYSIS_FILE, 'utf8'));
  if (FROM_PERIOD && !/^\d{4}-\d{2}$/.test(FROM_PERIOD))
    throw new Error('--from-period debe tener formato AAAA-MM.');
  const { records, excluded } = planImport(analysis.items, TIME_ZONE, FROM_PERIOD);
  const itemsByRow = new Map(analysis.items.map((item) => [item.sourceRow, item]));

  console.log(`📄 Análisis: ${ANALYSIS_FILE} (generado ${analysis.generatedAt})`);
  console.log(`🗄️  Base: ${target} en ${databaseHost(databaseUrl)}`);
  console.log(APPLY ? '✍️  Modo: APLICAR' : '🔍 Modo: simulación (no escribe)');

  const prisma = new PrismaClient();
  try {
    const actor = await prisma.adminUser.findUnique({
      where: { username },
      select: { id: true, status: true },
    });
    if (!actor || actor.status !== 'ACTIVE')
      throw new Error(`El usuario "${username}" no existe o no está activo.`);

    const results = [];
    for (const record of records) {
      const outcome = APPLY
        ? await importRecord(prisma, record, actor.id, path.basename(analysis.inputFile ?? ''))
        : ((await checkRecord(prisma, record)) ?? 'WOULD_IMPORT');
      results.push({ record, outcome });
    }

    const count = (outcome) => results.filter((result) => result.outcome === outcome).length;
    const importedOutcome = APPLY ? 'IMPORTED' : 'WOULD_IMPORT';
    const importedTotal = results
      .filter((result) => result.outcome === importedOutcome)
      .reduce((sum, { record }) => sum.plus(record.amount), new Prisma.Decimal(0));
    const reasonCounts = {};
    for (const { reasons } of excluded)
      for (const reason of reasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;

    const summary = {
      mode: APPLY ? 'APPLY' : 'DRY_RUN',
      database: target,
      analysisGeneratedAt: analysis.generatedAt,
      movements: analysis.items.length,
      importable: records.length,
      [APPLY ? 'imported' : 'wouldImport']: count(importedOutcome),
      importedAmount: importedTotal.toFixed(2),
      alreadyImported: count('ALREADY_IMPORTED'),
      chargeAlreadyExists: count('CHARGE_ALREADY_EXISTS'),
      enrollmentChanged: count('ENROLLMENT_CHANGED'),
      tariffNotFound: count('TARIFF_NOT_FOUND'),
      excluded: excluded.length,
      exclusionReasons: reasonCounts,
    };

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(
      REPORT_JSON,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          summary,
          results,
          excluded: excluded.map(({ item, reasons }) => ({ sourceRow: item.sourceRow, reasons })),
        },
        null,
        2,
      ),
      'utf8',
    );
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(
        results.map(({ record, outcome }) =>
          reportRow(itemsByRow.get(record.sourceRow), {
            Resultado: outcome,
            'Cuota (período)': record.period.slice(0, 7),
            Vencimiento: record.dueDate,
            Descuento: record.discountAmount,
            Ajustes: record.adjustments.map(({ type }) => type).join(', '),
          }),
        ),
      ),
      'Importables',
    );
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(
        excluded.map(({ item, reasons }) =>
          reportRow(item, {
            Motivos: reasons.join(', '),
            Detalle: item.flags
              .map(({ detail }) => detail)
              .filter(Boolean)
              .join(' | '),
          }),
        ),
      ),
      'Excluidos',
    );
    xlsx.writeFile(workbook, REPORT_XLSX);

    console.log(summary);
    console.log(`\n📄 ${REPORT_JSON}\n📊 ${REPORT_XLSX}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('\n❌ No se pudo completar la importación.');
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
