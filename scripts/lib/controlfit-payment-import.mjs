import { createHash } from 'node:crypto';

/*
 * Reglas puras de la importación histórica de cobros de ControlFit.
 * Trabajan sobre los movimientos producidos por
 * scripts/analyze-june-2026-payments.mjs y no acceden a la base.
 *
 * Los importes se manejan en centavos enteros para no operar con float.
 */

export const LATE_FEE_CENTS = 100_000;

/* Alertas del análisis compatibles con una importación automática. */
const ACCEPTED_FLAGS = new Set([
  // Se representa como descuento histórico sobre el costo.
  'TOTAL_BELOW_COST',
  // Se representa como recargo por mora de ARS 1.000.
  'POSSIBLE_LATE_FEE_1000',
  // El importe base es el costo informado por ControlFit, no la tarifa.
  'TARIFF_PERIOD_REVIEW',
  'COST_DIFFERS_FROM_TARIFF',
  // Inconsistencia de la inscripción que no afecta a la cuota.
  'ENDED_ENROLLMENT_WITHOUT_END_DATE',
]);

export const flagCodes = (item) => item.flags.map(({ code }) => code);

const toCents = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : null;

export const centsToDecimal = (cents) => {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
};

/* Cualquier alerta fuera de ACCEPTED_FLAGS, incluso una desconocida, excluye el movimiento. */
export const exclusionReasons = (item) => {
  const reasons = [];
  if (item.movementType !== 'QUOTA') reasons.push('NOT_A_QUOTA_PAYMENT');
  for (const code of flagCodes(item)) if (!ACCEPTED_FLAGS.has(code)) reasons.push(code);
  if (item.periodType !== 'MONTHLY' || !item.chargePeriod || !item.periodStart)
    reasons.push('NO_MONTHLY_PERIOD');
  if (!item.studentId || !item.classId || !item.enrollmentId) reasons.push('NOT_RESOLVED');
  if (!item.tariffId) reasons.push('TARIFF_NOT_RESOLVED');
  if (item.existingChargeId) reasons.push('CHARGE_ALREADY_EXISTS');
  if (!item.paymentMethodSupported) reasons.push('UNSUPPORTED_PAYMENT_METHOD');
  if (!item.paymentDateTime) reasons.push('INVALID_PAYMENT_DATE');

  const cost = toCents(item.cost);
  const total = toCents(item.total);
  if (cost === null || total === null || cost <= 0 || total <= 0) reasons.push('INVALID_AMOUNT');
  else if (total > cost && total - cost !== LATE_FEE_CENTS) reasons.push('TOTAL_ABOVE_COST');

  return [...new Set(reasons)];
};

/*
 * ControlFit informa la fecha y hora de reloj local, que la lectura del Excel
 * guarda como si fuera UTC. Se reinterpreta en la zona de negocio.
 */
const zoneOffsetMs = (date, timeZone) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  const wallClock = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return wallClock - Math.floor(date.getTime() / 1000) * 1000;
};

export const wallClockToUtc = (wallClockIso, timeZone) => {
  const asUtc = new Date(wallClockIso);
  if (Number.isNaN(asUtc.getTime())) throw new Error(`Fecha inválida: ${wallClockIso}`);
  const guess = new Date(asUtc.getTime() - zoneOffsetMs(asUtc, timeZone));
  return new Date(asUtc.getTime() - zoneOffsetMs(guess, timeZone));
};

/* No usa el número de fila: cambia entre exportaciones del mismo reporte. */
export const legacyReferenceFor = (item) =>
  `controlfit:${createHash('sha256')
    .update(
      [
        item.dniNormalized,
        item.activityText,
        item.paymentDateTime,
        item.paymentMethodRaw,
        item.cost,
        item.total,
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 40)}`;

/* El vencimiento debe caer entre el 1 y el 10 del período. */
const dueDateFor = (chargePeriod, periodStart) =>
  `${chargePeriod}-${String(Math.min(Number(periodStart.slice(8, 10)), 10)).padStart(2, '0')}`;

export const buildImportRecord = (item, timeZone) => {
  const cost = toCents(item.cost);
  const total = toCents(item.total);
  const adjustments = [];
  if (total < cost)
    adjustments.push({
      type: 'HISTORICAL_DISCOUNT',
      amountCents: cost - total,
      reason: `ControlFit cobró ${centsToDecimal(total)} sobre un costo de ${centsToDecimal(cost)}`,
    });
  if (total - cost === LATE_FEE_CENTS)
    adjustments.push({
      type: 'LATE_FEE',
      amountCents: LATE_FEE_CENTS,
      reason: 'Recargo cobrado en ControlFit',
    });

  return {
    legacyReference: legacyReferenceFor(item),
    sourceRow: item.sourceRow,
    movementNumber: item.movementNumber,
    studentId: item.studentId,
    classId: item.classId,
    enrollmentId: item.enrollmentId,
    tariffId: item.tariffId,
    period: `${item.chargePeriod}-01`,
    dueDate: dueDateFor(item.chargePeriod, item.periodStart),
    baseAmount: centsToDecimal(cost),
    discountAmount: centsToDecimal(Math.max(cost - total, 0)),
    // La base exige final = base - descuento; el recargo vive sólo en su ajuste.
    finalAmount: centsToDecimal(Math.min(cost, total)),
    amount: centsToDecimal(total),
    method: item.paymentMethod,
    paidAt: wallClockToUtc(item.paymentDateTime, timeZone).toISOString(),
    adjustments,
  };
};

/*
 * Devuelve los registros importables y los excluidos con sus motivos.
 * Dos movimientos que caerían en la misma cuota (inscripción y mes) se
 * excluyen juntos: no se fusionan ni se elige uno arbitrariamente.
 * `fromPeriod` (AAAA-MM) deja afuera las cuotas de períodos anteriores.
 */
export const planImport = (items, timeZone, fromPeriod = null) => {
  const excluded = [];
  const candidates = [];
  for (const item of items) {
    const reasons = exclusionReasons(item);
    if (fromPeriod && item.chargePeriod && item.chargePeriod < fromPeriod)
      reasons.push('BEFORE_IMPORT_RANGE');
    if (reasons.length > 0) excluded.push({ item, reasons });
    else candidates.push(item);
  }

  const byCharge = new Map();
  for (const item of candidates) {
    const key = `${item.enrollmentId}|${item.chargePeriod}`;
    byCharge.set(key, [...(byCharge.get(key) ?? []), item]);
  }

  const records = [];
  for (const group of byCharge.values()) {
    if (group.length > 1)
      for (const item of group) excluded.push({ item, reasons: ['SAME_CHARGE_IN_REPORT'] });
    else records.push(buildImportRecord(group[0], timeZone));
  }

  records.sort((a, b) => a.paidAt.localeCompare(b.paidAt) || a.sourceRow - b.sourceRow);
  excluded.sort((a, b) => a.item.sourceRow - b.item.sourceRow);
  return { records, excluded };
};
