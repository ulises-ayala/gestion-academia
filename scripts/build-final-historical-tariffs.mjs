import fs from 'node:fs/promises';
import path from 'node:path';

import xlsx from 'xlsx';

const {
  utils,
  writeFile,
} = xlsx;

/* =========================================================
 * CONFIG
 * ========================================================= */

const INPUT_FILE = path.resolve(
  './exports/historical-tariffs-analysis.json',
);

const OUTPUT_DIR = path.resolve(
  './exports',
);

const OUTPUT_JSON = path.join(
  OUTPUT_DIR,
  'historical-tariffs-ready.json',
);

const OUTPUT_XLSX = path.join(
  OUTPUT_DIR,
  'historical-tariffs-ready.xlsx',
);

const GAP_DECISIONS = {

  'ARABE INFANTIL|2026-05': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'La actividad continuó vigente y el cambio a $40.000 ocurrió recién en agosto de 2026.',
  },

  'ARABE INFANTIL|2026-06': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'La actividad continuó vigente y el cambio a $40.000 ocurrió recién en agosto de 2026.',
  },

  'ARABE INFANTIL|2026-07': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'La cuota normal era $30.000; los $15.000 observados correspondían a medio mes.',
  },

  'ALL|2025-12': {
    decision: 'NO_ACTIVITY',
    reason: 'La academia confirmó que no hubo actividad en diciembre de 2025.',
  },

  'ALL|2026-04': {
    decision: 'CARRY_FORWARD',
    amount: '30000.00',
    reason: 'La academia confirmó actividad en abril de 2026 y cuota general de $30.000.',
  },

  'ARABE INFANTIL|2025-08': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '20000.00',
    reason: 'Tarifa confirmada por la academia.',
  },

  'ARABE INFANTIL|2025-09': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Tarifa confirmada por la academia.',
  },

  'ARABE INFANTIL|2025-10': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Tarifa confirmada por la academia.',
  },

  'ARABE INFANTIL|2025-11': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Tarifa confirmada por la academia.',
  },

  'KIDS 4 5 ANOS|2025-08': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '20000.00',
    reason: 'Tarifa confirmada por la academia.',
  },

  'KIDS 4 5 ANOS|2025-09': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Tarifa confirmada por la academia.',
  },

  'KIDS 4 5 ANOS|2025-10': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Tarifa confirmada por la academia.',
  },

  'KIDS 4 5 ANOS|2025-11': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Tarifa confirmada por la academia.',
  },

  'BACHATA Y SALSA INICIAL|2025-08': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '20000.00',
    reason: 'Tarifa confirmada por la academia.',
  },

  'BACHATA Y SALSA INICIAL|2025-09': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Tarifa confirmada por la academia.',
  },

  'BACHATA Y SALSA INICIAL|2025-10': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Tarifa confirmada por la academia.',
  },

  'BACHATA Y SALSA INICIAL|2025-11': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Tarifa confirmada por la academia.',
  },

  'BACHATA Y SALSA INICIAL|2026-01': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Cuota general confirmada por la academia.',
  },

  'BACHATA Y SALSA INICIAL|2026-02': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Cuota general confirmada por la academia.',
  },

  'BACHATA Y SALSA INICIAL|2026-03': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Cuota general confirmada por la academia.',
  },

  'BACHATA Y SALSA INICIAL|2026-04': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Cuota general confirmada por la academia.',
  },

  'ARABE INFANTIL|2026-01': {
  decision: 'CONFIRMED_AMOUNT',
  amount: '30000.00',
  reason: 'La academia confirmó que retomó en enero de 2026 con cuota general de $30.000.',
},

  'ARABE INFANTIL|2026-02': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Cuota general confirmada por la academia.',
  },

  'ARABE INFANTIL|2026-03': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Cuota general confirmada por la academia.',
  },

  'ARABE INFANTIL|2026-04': {
    decision: 'CONFIRMED_AMOUNT',
    amount: '30000.00',
    reason: 'Cuota general confirmada por la academia.',
  },

};

function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function gapDecisionKey(className, period) {
  return `${normalizeKey(className)}|${period}`;
}

function resolveGapDecision(className, period) {
  return (
    GAP_DECISIONS[
      gapDecisionKey(className, period)
    ] ??
    GAP_DECISIONS[`ALL|${period}`] ??
    null
  );
}

/* =========================================================
 * HELPERS
 * ========================================================= */

function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  /*
   * Si ya recibimos un Date,
   * simplemente lo copiamos.
   */
  if (value instanceof Date) {
    if (
      Number.isNaN(
        value.getTime(),
      )
    ) {
      return null;
    }

    return new Date(
      value.getTime(),
    );
  }

  /*
   * Si recibimos YYYY-MM-DD,
   * lo convertimos en UTC.
   */
  const stringValue =
    String(value)
      .trim();

  const date =
    new Date(
      `${stringValue}T00:00:00.000Z`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date;
}

function isoDate(date) {
  if (
    !(date instanceof Date) ||
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      `isoDate recibió una fecha inválida: ${date}`,
    );
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function monthKey(value) {
  return value
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

function previousMonthEnd(date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      0,
    ),
  );
}

function monthsBetween(
  left,
  right,
) {
  return (
    (
      right.getUTCFullYear() -
      left.getUTCFullYear()
    ) *
      12 +
    (
      right.getUTCMonth() -
      left.getUTCMonth()
    )
  );
}

function normalizeAmount(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return null;
  }

  return number.toFixed(2);
}

function tariffName(
  className,
  validFrom,
  amount,
) {
  const year =
    validFrom.slice(0, 4);

  return (
    `Histórica - ${className} - ` +
    `${year} - $${Number(amount).toLocaleString('es-AR')}`
  );
}

/* =========================================================
 * CARGA
 * ========================================================= */

async function readAnalysis() {
  const raw =
    await fs.readFile(
      INPUT_FILE,
      'utf8',
    );

  return JSON.parse(raw);
}

/* =========================================================
 * AGRUPACIÓN
 * ========================================================= */

function groupByClass(items) {
  const groups =
    new Map();

  for (
    const item
    of items
  ) {
    if (!item.classId) {
      continue;
    }

    if (
      !groups.has(
        item.classId,
      )
    ) {
      groups.set(
        item.classId,
        [],
      );
    }

    groups
      .get(
        item.classId,
      )
      .push(
        item,
      );
  }

  return groups;
}

/* =========================================================
 * VALIDACIÓN DE REGISTROS
 * ========================================================= */

function validateItem(item) {
  const errors = [];

  if (!item.classId) {
    errors.push(
      'MISSING_CLASS_ID',
    );
  }

  if (!item.className) {
    errors.push(
      'MISSING_CLASS_NAME',
    );
  }

  if (!item.validFrom) {
    errors.push(
      'MISSING_VALID_FROM',
    );
  }

  if (!item.validTo) {
    errors.push(
      'MISSING_VALID_TO',
    );
  }

  if (!normalizeAmount(item.amount)) {
    errors.push(
      'INVALID_AMOUNT',
    );
  }

  return errors;
}

/* =========================================================
 * CONSTRUCCIÓN DE TIMELINE
 * ========================================================= */

function buildTimeline(
  classItems,
) {
  const sorted =
    [...classItems]
      .sort(
        (a, b) =>
          a.validFrom.localeCompare(
            b.validFrom,
          ),
      );

  const timeline = [];

  for (
    const item
    of sorted
  ) {
    timeline.push({
      ...item,

      amount:
        normalizeAmount(
          item.amount,
        ),

      startMonth:
        firstDayOfMonth(
          item.validFrom,
        ),

      endMonth:
        firstDayOfMonth(
          item.validTo,
        ),
    });
  }

  return timeline;
}

/* =========================================================
 * DETECTAR MESES ESPECIALES
 * ========================================================= */

function buildSpecialPeriods(
  allItems,
) {
  const specials =
    new Map();

  for (
    const item
    of allItems
  ) {
    if (
      item.result !==
      'NOT_A_TARIFF'
    ) {
      continue;
    }

    if (
      !item.classId ||
      !item.validFrom
    ) {
      continue;
    }

    const key =
      `${item.classId}|` +
      `${monthKey(item.validFrom)}`;

    specials.set(
      key,
      item,
    );
  }

  return specials;
}

/* =========================================================
 * CONSOLIDAR
 * ========================================================= */

function consolidateTimeline(
  timeline,
  specialPeriods,
) {
  if (
    timeline.length === 0
  ) {
    return {
      tariffs: [],
      alerts: [],
    };
  }

  const alerts = [];
  const tariffs = [];

  let current = {
    classId:
      timeline[0].classId,

    className:
      timeline[0].className,

    amount:
      timeline[0].amount,

    validFrom:
      timeline[0].validFrom,

    validTo:
      timeline[0].validTo,

    sourcePeriods: [
      {
        validFrom:
          timeline[0].validFrom,

        validTo:
          timeline[0].validTo,

        amount:
          timeline[0].amount,

        sourceRows:
          timeline[0].sourceRows,
      },
    ],

    bridgedSpecialPeriods:
      [],
  };

  for (
    let index = 1;
    index < timeline.length;
    index++
  ) {
    const next =
      timeline[index];

    const currentEnd =
      firstDayOfMonth(
        current.validTo,
      );

    const nextStart =
      firstDayOfMonth(
        next.validFrom,
      );

    const monthGap =
      monthsBetween(
        currentEnd,
        nextStart,
      );

    const sameAmount =
      current.amount ===
      next.amount;

    /*
     * Caso 1:
     * período inmediatamente contiguo
     * y mismo importe.
     */
    if (
      monthGap === 1 &&
      sameAmount
    ) {
      current.validTo =
        next.validTo;

      current.sourcePeriods.push({
        validFrom:
          next.validFrom,

        validTo:
          next.validTo,

        amount:
          next.amount,

        sourceRows:
          next.sourceRows,
      });

      continue;
    }

    /*
     * Caso 2:
     * hay uno o más meses entre ambos.
     *
     * Solo extendemos si TODOS los meses
     * intermedios están marcados como
     * NOT_A_TARIFF para esa misma clase.
     */
    if (
      monthGap > 1
    ) {
      const missingMonths = [];

      let cursor =
        nextMonth(
          currentEnd,
        );

      while (
        cursor <
        nextStart
      ) {
        missingMonths.push(
          new Date(
            cursor,
          ),
        );

        cursor =
          nextMonth(
            cursor,
          );
      }

        const gapDecisions =
          missingMonths.map(
            (month) => {
              const period =
                isoDate(month)
                  .slice(0, 7);

              return {
                period,
                month,
                decision:
                  resolveGapDecision(
                    current.className,
                    period,
                  ),
              };
            },
          );

          const specialGapPeriods =
            gapDecisions.filter(
              ({ period, decision }) =>
                !decision &&
                specialPeriods.has(
                  `${current.classId}|${period}`,
                ),
            );



        const unresolved =
          gapDecisions.filter(
             ({ period, decision }) =>
              !decision &&
               !specialPeriods.has(
                 `${current.classId}|${period}`,
              ),
            );

        if (
          unresolved.length > 0
        ) {
          alerts.push({
            type:
              'UNEXPLAINED_GAP',

            classId:
              current.classId,

            className:
              current.className,

            previousValidTo:
              current.validTo,

            nextValidFrom:
              next.validFrom,

            missingMonths:
              unresolved.map(
                ({ period }) =>
                  period,
              ),
          });
        }

        const carryForward =
        gapDecisions.filter(
          ({ decision }) =>
            decision?.decision ===
            'CARRY_FORWARD',
        );

        if (specialGapPeriods.length > 0) {
        const lastSpecial =
          specialGapPeriods[
            specialGapPeriods.length - 1
          ];

        current.validTo =
          isoDate(
            lastDayOfMonth(
              lastSpecial.month,
            ),
          );

        current.bridgedSpecialPeriods.push(
          ...specialGapPeriods.map(
            ({ period }) => {
              const special =
                specialPeriods.get(
                  `${current.classId}|${period}`,
                );

              return {
                period,
                observedAmount:
                  special?.amount ?? null,
                reason:
                  special?.priceDecisionReason ??
                  'Importe especial confirmado como no tarifa',
              };
            },
          ),
        );
      }
      if (
        carryForward.length > 0
      ) {
        const last =
          carryForward[
            carryForward.length - 1
          ];

        current.validTo =
          isoDate(
            lastDayOfMonth(
              last.month,
            ),
          );
      }
      for (
        const gap
        of gapDecisions
      ) {
        if (
          gap.decision?.decision !==
          'CONFIRMED_AMOUNT'
        ) {
          continue;
        }

        tariffs.push({
          classId:
            current.classId,

          className:
            current.className,

          amount:
            gap.decision.amount,

          validFrom:
            `${gap.period}-01`,

          validTo:
            isoDate(
              lastDayOfMonth(
                gap.month,
              ),
            ),

          sourcePeriods:
            [],

          bridgedSpecialPeriods:
            [],

          name:
            tariffName(
              current.className,
              `${gap.period}-01`,
              gap.decision.amount,
            ),
        });
      }
    }

    /*
     * Cerramos tarifa actual.
     */
    tariffs.push({
      ...current,

      name:
        tariffName(
          current.className,
          current.validFrom,
          current.amount,
        ),
    });

    /*
     * Comenzamos una nueva.
     */
    current = {
      classId:
        next.classId,

      className:
        next.className,

      amount:
        next.amount,

      validFrom:
        next.validFrom,

      validTo:
        next.validTo,

      sourcePeriods: [
        {
          validFrom:
            next.validFrom,

          validTo:
            next.validTo,

          amount:
            next.amount,

          sourceRows:
            next.sourceRows,
        },
      ],

      bridgedSpecialPeriods:
        [],
    };
  }

  tariffs.push({
    ...current,

    name:
      tariffName(
        current.className,
        current.validFrom,
        current.amount,
      ),
  });

  return {
    tariffs,
    alerts,
  };
}

function consolidateFinalTariffs(tariffs) {
  const sorted = [...tariffs].sort(
    (a, b) =>
      a.classId.localeCompare(b.classId) ||
      a.validFrom.localeCompare(b.validFrom) ||
      a.validTo.localeCompare(b.validTo),
  );

  const result = [];
  const overlaps = [];

  for (const tariff of sorted) {
    const normalized = {
      ...tariff,
      amount: normalizeAmount(tariff.amount),
    };

    const previous =
      result.length > 0
        ? result[result.length - 1]
        : null;

    if (
      !previous ||
      previous.classId !== normalized.classId
    ) {
      result.push(normalized);
      continue;
    }

    const previousEnd =
      parseIsoDate(previous.validTo);

    const currentStart =
      parseIsoDate(normalized.validFrom);

    const previousNextMonth =
      nextMonth(
        firstDayOfMonth(previous.validTo),
      );

    /*
     * SOLAPAMIENTO:
     * dos tarifas de la misma clase cubren
     * al menos parte del mismo período.
     */
    if (currentStart <= previousEnd) {
      /*
       * Si importe es igual, podemos fusionarlas.
       */
      if (previous.amount === normalized.amount) {
        if (
          parseIsoDate(normalized.validTo) >
          previousEnd
        ) {
          previous.validTo =
            normalized.validTo;
        }

        previous.sourcePeriods.push(
          ...(normalized.sourcePeriods ?? []),
        );

        previous.bridgedSpecialPeriods.push(
          ...(normalized.bridgedSpecialPeriods ?? []),
        );

        continue;
      }

      /*
       * Si importes son distintos, NO decidimos automáticamente.
       */
      overlaps.push({
        type: 'OVERLAPPING_DIFFERENT_AMOUNTS',
        classId: normalized.classId,
        className: normalized.className,

        first: {
          amount: previous.amount,
          validFrom: previous.validFrom,
          validTo: previous.validTo,
        },

        second: {
          amount: normalized.amount,
          validFrom: normalized.validFrom,
          validTo: normalized.validTo,
        },
      });

      result.push(normalized);
      continue;
    }

    /*
     * Contiguos y mismo importe:
     * fusionar.
     */
    if (
      previous.amount === normalized.amount &&
      previousNextMonth.getTime() ===
        firstDayOfMonth(
          normalized.validFrom,
        ).getTime()
    ) {
      previous.validTo =
        normalized.validTo;

      previous.sourcePeriods.push(
        ...(normalized.sourcePeriods ?? []),
      );

      previous.bridgedSpecialPeriods.push(
        ...(normalized.bridgedSpecialPeriods ?? []),
      );

      continue;
    }

    result.push(normalized);
  }

  return {
    tariffs: result,
    overlaps,
  };
}


/* =========================================================
 * MAIN
 * ========================================================= */

async function main() {
  console.log('');

  console.log(
    '📥 Leyendo análisis histórico...',
  );

  console.log(
    `📄 ${INPUT_FILE}`,
  );

  const analysis =
    await readAnalysis();

  const items =
    analysis.items ?? [];

  console.log(
    `📊 Registros analizados: ${items.length}`,
  );

  const pending =
    items.filter(
      (item) =>
        item.result ===
          'REVIEW_CLASS' ||
        item.result ===
          'REVIEW_PRICE' ||
        item.result ===
          'REVIEW_CLASS_AND_PRICE',
    );

  if (
    pending.length > 0
  ) {
    throw new Error(
      `El análisis todavía contiene ${pending.length} registros pendientes de revisión.`,
    );
  }

  const valid =
    items.filter(
      (item) =>
        item.result ===
        'OK',
    );

  const special =
    items.filter(
      (item) =>
        item.result ===
        'NOT_A_TARIFF',
    );

  console.log(
    `✅ Tarifas candidatas válidas: ${valid.length}`,
  );

  console.log(
    `🚫 Importes especiales: ${special.length}`,
  );

  /* =======================================================
   * VALIDACIÓN
   * ======================================================= */

  const invalid = [];

  for (
    const item
    of valid
  ) {
    const errors =
      validateItem(
        item,
      );

    if (
      errors.length > 0
    ) {
      invalid.push({
        item,
        errors,
      });
    }
  }

  if (
    invalid.length > 0
  ) {
    console.log('');

    console.log(
      '❌ Registros inválidos:',
    );

    for (
      const entry
      of invalid
    ) {
      console.log(
        entry.item.activity,
        entry.errors,
      );
    }

    throw new Error(
      'Hay registros OK inválidos. Revisá el análisis antes de continuar.',
    );
  }

  /* =======================================================
   * AGRUPAR
   * ======================================================= */

  const groups =
    groupByClass(
      valid,
    );

  const specialPeriods =
    buildSpecialPeriods(
      special,
    );

  const finalTariffs = [];
  const alerts = [];

  for (
    const [
      classId,
      classItems,
    ]
    of groups
  ) {
    const timeline =
      buildTimeline(
        classItems,
      );

    const result =
      consolidateTimeline(
        timeline,
        specialPeriods,
      );

    finalTariffs.push(
      ...result.tariffs,
    );

    alerts.push(
      ...result.alerts,
    );
  }

  const postProcessed =
    consolidateFinalTariffs(
      finalTariffs,
    );

  finalTariffs.length = 0;

  finalTariffs.push(
    ...postProcessed.tariffs,
  );

  finalTariffs.sort(
    (a, b) =>
      a.className.localeCompare(
        b.className,
        'es',
      ) ||
      a.validFrom.localeCompare(
        b.validFrom,
      ),
  );

  /* =======================================================
   * RESUMEN
   * ======================================================= */

  const classes =
    new Set(
      finalTariffs.map(
        (item) =>
          item.classId,
      ),
    );

  console.log('');

  console.log(
    '📊 RESULTADO FINAL',
  );

  console.log(
    `💃 Clases con tarifas: ${classes.size}`,
  );

  console.log(
    `💰 Tarifas consolidadas: ${finalTariffs.length}`,
  );

  console.log(
    `🌉 Períodos especiales puenteados: ${
      finalTariffs.reduce(
        (sum, tariff) =>
          sum +
          tariff
            .bridgedSpecialPeriods
            .length,
        0,
      )
    }`,
  );
  

  console.log(
    `⚠️ Huecos sin explicar: ${alerts.length}`,
  );

  console.log(
    `💥 Solapamientos conflictivos: ${
      postProcessed.overlaps.length
    }`,
  );

  /* =======================================================
   * JSON
   * ======================================================= */

  await fs.mkdir(
    OUTPUT_DIR,
    {
      recursive: true,
    },
  );

  const output = {
    generatedAt:
      new Date()
        .toISOString(),

    source:
      INPUT_FILE,

    summary: {
      sourceItems:
        items.length,

      validSourceItems:
        valid.length,

      specialSourceItems:
        special.length,

      classCount:
        classes.size,

      tariffCount:
        finalTariffs.length,

      bridgedSpecialPeriods:
        finalTariffs.reduce(
          (sum, tariff) =>
            sum +
            tariff
              .bridgedSpecialPeriods
              .length,
          0,
        ),

      unexplainedGaps:
        alerts.length,

      conflictingOverlaps:
        postProcessed.overlaps.length,
    },

    tariffs:
      finalTariffs,

    specialPeriods:
      special.map(
        (item) => ({
          classId:
            item.classId,

          className:
            item.className,

          activity:
            item.activity,

          teacher:
            item.teacher,

          period:
            item.validFrom
              ?.slice(0, 7) ??
            null,

          observedAmount:
            item.amount,

          reason:
            item
              .priceDecisionReason ??
            null,
        }),
      ),

    alerts,

    overlaps:
      postProcessed.overlaps,
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

  /* =======================================================
   * XLSX
   * ======================================================= */

  const workbook =
    utils.book_new();

  const tariffRows =
    finalTariffs.map(
      (item) => ({
        'Class ID':
          item.classId,

        Clase:
          item.className,

        Nombre:
          item.name,

        Importe:
          item.amount,

        'Vigencia desde':
          item.validFrom,

        'Vigencia hasta':
          item.validTo,

        'Períodos fuente':
          item.sourcePeriods
            .map(
              (source) =>
                `${source.validFrom.slice(0, 7)} = $${source.amount}`,
            )
            .join(' | '),

        'Períodos especiales puenteados':
          item.bridgedSpecialPeriods
            .map(
              (period) =>
                `${period.period} ($${period.observedAmount})`,
            )
            .join(' | '),
      }),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      tariffRows,
    ),
    'Tarifas finales',
  );

  const specialRows =
    output.specialPeriods.map(
      (item) => ({
        Clase:
          item.className,

        Actividad:
          item.activity,

        Profesor:
          item.teacher,

        Periodo:
          item.period,

        'Importe observado':
          item.observedAmount,

        Motivo:
          item.reason,
      }),
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      specialRows,
    ),
    'Importes especiales',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      alerts.map(
        (alert) => ({
          Tipo:
            alert.type,

          Clase:
            alert.className,

          'Vigencia anterior hasta':
            alert.previousValidTo,

          'Próxima vigencia desde':
            alert.nextValidFrom,

          'Meses faltantes':
            alert.missingMonths.join(
              ', ',
            ),
        }),
      ),
    ),
    'Alertas',
  );

    utils.book_append_sheet(
      workbook,
      utils.json_to_sheet(
        postProcessed.overlaps.map(
          (overlap) => ({
            Tipo:
              overlap.type,

            Clase:
              overlap.className,

            'Importe 1':
              overlap.first.amount,

            'Desde 1':
              overlap.first.validFrom,

            'Hasta 1':
              overlap.first.validTo,

            'Importe 2':
              overlap.second.amount,

            'Desde 2':
              overlap.second.validFrom,

            'Hasta 2':
              overlap.second.validTo,
          }),
        ),
      ),
      'Solapamientos',
    );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet([
      {
        Métrica:
          'Registros fuente',

        Cantidad:
          items.length,
      },

      {
        Métrica:
          'Registros OK',

        Cantidad:
          valid.length,
      },

      {
        Métrica:
          'Importes especiales',

        Cantidad:
          special.length,
      },

      {
        Métrica:
          'Clases con tarifas',

        Cantidad:
          classes.size,
      },

      {
        Métrica:
          'Tarifas consolidadas',

        Cantidad:
          finalTariffs.length,
      },

      {
        Métrica:
          'Períodos especiales puenteados',

        Cantidad:
          output.summary
            .bridgedSpecialPeriods,
      },

      {
        Métrica:
          'Huecos sin explicar',

        Cantidad:
          alerts.length,
      },

      {
        Métrica:
          'Solapamientos conflictivos',

        Cantidad:
          postProcessed.overlaps.length,
      },
    ]),
    'Resumen',
  );

  writeFile(
    workbook,
    OUTPUT_XLSX,
  );

  console.log('');

  console.log(
    `📄 JSON: ${OUTPUT_JSON}`,
  );

  console.log(
    `📊 Excel: ${OUTPUT_XLSX}`,
  );

    if (
      alerts.length > 0 ||
      postProcessed.overlaps.length > 0
    ) {
      console.log('');

      console.log(
        '⚠️ Quedan huecos o solapamientos sin resolver. No recomiendo importar todavía.',
      );
    } else {
      console.log('');

      console.log(
        '✅ Dataset final listo para revisión.',
      );
    }
}

await main();