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

const RESOLUTION_PLAN_FILE = path.resolve(
  './exports/no-tariff-resolution-plan.json',
);

const EXISTING_READY_FILE = path.resolve(
  './exports/historical-tariffs-ready.json',
);

const OUTPUT_DIR = path.resolve(
  './exports',
);

const OUTPUT_JSON = path.join(
  OUTPUT_DIR,
  'missing-class-tariffs-ready.json',
);

const OUTPUT_XLSX = path.join(
  OUTPUT_DIR,
  'missing-class-tariffs-ready.xlsx',
);

/*
 * Calendario de cuota general reconstruido y confirmado.
 *
 * Enero 2025 NO se incluye porque continúa sin
 * confirmación suficiente.
 *
 * Diciembre 2025 NO se incluye porque no hubo
 * actividad ni cuota.
 */
const GENERAL_RATE_PERIODS = [
  {
    validFrom:
      '2025-02-01',

    validTo:
      '2025-02-28',

    amount:
      '15000.00',

    evidence:
      'Tarifa general histórica reconstruida para febrero de 2025.',
  },

  {
    validFrom:
      '2025-03-01',

    validTo:
      '2025-08-31',

    amount:
      '20000.00',

    evidence:
      'Cuota general de $20.000; mayo-agosto 2025 confirmados por PO.',
  },

  {
    validFrom:
      '2025-09-01',

    validTo:
      '2025-11-30',

    amount:
      '30000.00',

    evidence:
      'Cuota general de $30.000 confirmada por PO.',
  },

  /*
   * 2025-12:
   * NO_ACTIVITY.
   */

  {
    validFrom:
      '2026-01-01',

    validTo:
      '2026-06-30',

    amount:
      '30000.00',

    evidence:
      'Cuota general de $30.000 confirmada por PO.',
  },

  {
    validFrom:
      '2026-07-01',

    validTo:
      '2026-07-31',

    amount:
      '15000.00',

    evidence:
      'PO confirmó media cuota/receso de julio 2026.',
  },

  {
    validFrom:
      '2026-08-01',

    validTo:
      '2026-08-31',

    amount:
      '40000.00',

    evidence:
      'Cuota general de $40.000 confirmada desde agosto de 2026.',
  },
];

/*
 * Pendientes de PO.
 *
 * Cuando obtengamos las fechas podemos completar
 * estas constantes y el script dejará de bloquearlos.
 */
const COREOGRAFICO_URBAN_GENERAL_RATE_UNTIL =
  null;

const INSTITUTO_TANGO_VALID_FROM =
  null;

const INSTITUTO_TANGO_VALID_TO =
  null;

/* =========================================================
 * HELPERS
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

function normalizeAmount(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number.toFixed(2);
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  return String(value)
    .slice(0, 10);
}

function tariffName(
  className,
  validFrom,
  amount,
) {
  const year =
    validFrom.slice(
      0,
      4,
    );

  return (
    `Histórica - ${className} - ` +
    `${year} - $${Number(amount).toLocaleString('es-AR')}`
  );
}

async function readJson(file) {
  const raw =
    await fs.readFile(
      file,
      'utf8',
    );

  return JSON.parse(raw);
}

/* =========================================================
 * PLAN INDEX
 * ========================================================= */

function indexPlansByClass(
  plans,
) {
  const map =
    new Map();

  for (
    const plan
    of plans
  ) {
    map.set(
      normalizeText(
        plan.sourceClassName,
      ),
      plan,
    );
  }

  return map;
}

function requirePlan(
  planIndex,
  className,
) {
  const plan =
    planIndex.get(
      normalizeText(
        className,
      ),
    );

  if (!plan) {
    throw new Error(
      `No encontré "${className}" en no-tariff-resolution-plan.json`,
    );
  }

  return plan;
}

/* =========================================================
 * BUILDERS
 * ========================================================= */

function makeTariff({
  classId,
  className,
  amount,
  validFrom,
  validTo,
  source,
  reason,
}) {
  const normalizedAmount =
    normalizeAmount(
      amount,
    );

  return {
    classId,

    className,

    name:
      tariffName(
        className,
        validFrom,
        normalizedAmount,
      ),

    amount:
      normalizedAmount,

    validFrom:
      normalizeDate(
        validFrom,
      ),

    validTo:
      normalizeDate(
        validTo,
      ),

    source,

    reason,
  };
}

function buildGeneralRateTariffs(
  plan,
  {
    validUntil = null,
  } = {},
) {
  const classId =
    plan.sourceClassId;

  const className =
    plan.sourceClassName;

  if (
    !classId
  ) {
    throw new Error(
      `La clase ${className} no tiene classId.`,
    );
  }

  return GENERAL_RATE_PERIODS
    .filter(
      (period) => {
        if (!validUntil) {
          return true;
        }

        return (
          period.validFrom <=
          validUntil
        );
      },
    )
    .map(
      (period) => {
        let validTo =
          period.validTo;

        if (
          validUntil &&
          validTo >
            validUntil
        ) {
          validTo =
            validUntil;
        }

        return makeTariff({
          classId,

          className,

          amount:
            period.amount,

          validFrom:
            period.validFrom,

          validTo,

          source:
            'GENERAL_ACADEMY_RATE',

          reason:
            period.evidence,
        });
      },
    );
}

/* =========================================================
 * VALIDACIONES
 * ========================================================= */

function rangesOverlap(
  left,
  right,
) {
  const leftStart =
    normalizeDate(
      left.validFrom,
    );

  const leftEnd =
    normalizeDate(
      left.validTo,
    ) ??
    '9999-12-31';

  const rightStart =
    normalizeDate(
      right.validFrom,
    );

  const rightEnd =
    normalizeDate(
      right.validTo,
    ) ??
    '9999-12-31';

  return (
    leftStart <=
      rightEnd &&
    rightStart <=
      leftEnd
  );
}

function findInternalOverlaps(
  tariffs,
) {
  const overlaps = [];

  for (
    let i = 0;
    i < tariffs.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < tariffs.length;
      j++
    ) {
      const left =
        tariffs[i];

      const right =
        tariffs[j];

      if (
        left.classId !==
        right.classId
      ) {
        continue;
      }

      if (
        rangesOverlap(
          left,
          right,
        )
      ) {
        overlaps.push({
          left,
          right,
        });
      }
    }
  }

  return overlaps;
}

function findExistingConflicts(
  newTariffs,
  existingTariffs,
) {
  const conflicts = [];

  for (
    const candidate
    of newTariffs
  ) {
    for (
      const existing
      of existingTariffs
    ) {
      if (
        existing.classId !==
        candidate.classId
      ) {
        continue;
      }

      if (
        !rangesOverlap(
          candidate,
          existing,
        )
      ) {
        continue;
      }

      conflicts.push({
        candidate,

        existing:
          {
            classId:
              existing.classId,

            className:
              existing.className,

            amount:
              normalizeAmount(
                existing.amount,
              ),

            validFrom:
              normalizeDate(
                existing.validFrom,
              ),

            validTo:
              normalizeDate(
                existing.validTo,
              ),
          },
      });
    }
  }

  return conflicts;
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
    ' BUILD DE TARIFAS FALTANTES',
  );

  console.log(
    '=========================================================',
  );

  console.log('');

  const resolutionFile =
    await readJson(
      RESOLUTION_PLAN_FILE,
    );

  const plans =
    resolutionFile.plans ??
    [];

  const existingReady =
    await readJson(
      EXISTING_READY_FILE,
    );

  const existingTariffs =
    Array.isArray(
      existingReady,
    )
      ? existingReady
      : existingReady.tariffs ??
        [];

  const planIndex =
    indexPlansByClass(
      plans,
    );

  console.log(
    `📋 Planes disponibles: ${plans.length}`,
  );

  console.log(
    `💰 Tarifas existentes: ${existingTariffs.length}`,
  );

  const ready = [];
  const blocked = [];
  const ignored = [];

  /* =======================================================
   * CLASE KIZOMBA
   * ======================================================= */

  {
    const plan =
      requirePlan(
        planIndex,
        'Clase kizomba',
      );

    ready.push(
      ...buildGeneralRateTariffs(
        plan,
      ),
    );
  }

  /* =======================================================
   * FORMACIÓN DOCENTE
   * ======================================================= */

  {
    const plan =
      requirePlan(
        planIndex,
        'Formacion Docente En Ritmos Caribeños Y Kizomba',
      );

    ready.push(
      makeTariff({
        classId:
          plan.sourceClassId,

        className:
          plan.sourceClassName,

        amount:
          '90000.00',

        validFrom:
          '2026-04-01',

        validTo:
          '2026-12-31',

        source:
          'PO_CONFIRMED_SPECIAL_PROGRAM',

        reason:
          'PO confirmó cuota base mensual de $90.000 desde abril hasta diciembre de 2026. $76.500, $72.000 y becas son condiciones particulares.',
      }),
    );
  }

  /* =======================================================
   * COREOGRÁFICO E.MASC / URBAN
   * ======================================================= */

  {
    const plan =
      requirePlan(
        planIndex,
        'Coreografico E.Masc-Bachata/Urban',
      );

    if (
      !COREOGRAFICO_URBAN_GENERAL_RATE_UNTIL
    ) {
      blocked.push({
        classId:
          plan.sourceClassId,

        className:
          plan.sourceClassName,

        issue:
          'MISSING_URBAN_FLOW_TRANSITION_DATE',

        knownRule:
          'Antes del cambio a Urban Flow utilizaba la cuota general de la academia.',

        required:
          'Confirmar hasta qué mes/año se aplicó la cuota general y desde qué mes comenzó Urban Flow con $20.000.',

        status:
          'BLOCKED',
      });
    } else {
      ready.push(
        ...buildGeneralRateTariffs(
          plan,
          {
            validUntil:
              COREOGRAFICO_URBAN_GENERAL_RATE_UNTIL,
          },
        ),
      );
    }
  }

  /* =======================================================
   * INSTITUTO TANGO / 18 MESES
   * ======================================================= */

  {
    const plan =
      requirePlan(
        planIndex,
        'Inst.Sup.Coreografico -Tango /18 Meses',
      );

    if (
      !INSTITUTO_TANGO_VALID_FROM ||
      !INSTITUTO_TANGO_VALID_TO
    ) {
      blocked.push({
        classId:
          plan.sourceClassId,

        className:
          plan.sourceClassName,

        amount:
          '70000.00',

        issue:
          'MISSING_SPECIAL_PROGRAM_PERIOD',

        required:
          'Confirmar desde qué mes/año hasta qué mes/año se cobró la cuota de $70.000.',

        status:
          'BLOCKED',
      });
    } else {
      ready.push(
        makeTariff({
          classId:
            plan.sourceClassId,

          className:
            plan.sourceClassName,

          amount:
            '70000.00',

          validFrom:
            INSTITUTO_TANGO_VALID_FROM,

          validTo:
            INSTITUTO_TANGO_VALID_TO,

          source:
            'PO_CONFIRMED_SPECIAL_PROGRAM',

          reason:
            'PO confirmó cuota mensual base de $70.000.',
        }),
      );
    }
  }

  /* =======================================================
   * MAPPINGS QUE NO GENERAN TARIFA AQUÍ
   * ======================================================= */

  for (
    const className
    of [
      'S&B Parejas',
      'Hells',
      'Grupo C. Sofi',
    ]
  ) {
    const plan =
      requirePlan(
        planIndex,
        className,
      );

    ignored.push({
      classId:
        plan.sourceClassId,

      className:
        plan.sourceClassName,

      resolution:
        plan.resolution,

      reason:
        'Se resuelve primero mediante mapping/renombre/movimiento de enrollments. No se genera tarifa en este builder.',
    });
  }

  {
    const plan =
      requirePlan(
        planIndex,
        'arabashe',
      );

    ignored.push({
      classId:
        plan.sourceClassId,

      className:
        plan.sourceClassName,

      resolution:
        'IGNORE_TEST_CLASS',

      reason:
        'Clase de prueba que será eliminada.',
    });
  }

  /* =======================================================
   * VALIDACIONES
   * ======================================================= */

  const internalOverlaps =
    findInternalOverlaps(
      ready,
    );

  const existingConflicts =
    findExistingConflicts(
      ready,
      existingTariffs,
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

  console.log('');
  console.log(
    `✅ Tarifas listas: ${ready.length}`,
  );

  console.log(
    `⏳ Clases bloqueadas: ${blocked.length}`,
  );

  console.log(
    `↩️ Clases resueltas por mapping/ignoradas: ${ignored.length}`,
  );

  console.log(
    `💥 Solapamientos internos: ${internalOverlaps.length}`,
  );

  console.log(
    `⚠️ Conflictos contra ready existente: ${existingConflicts.length}`,
  );

  console.log('');

  for (
    const tariff
    of ready
  ) {
    console.log(
      `✅ ${tariff.className} | $${tariff.amount} | ${tariff.validFrom} → ${tariff.validTo}`,
    );
  }

  if (
    blocked.length > 0
  ) {
    console.log('');
    console.log(
      '--- BLOQUEADOS ---',
    );

    for (
      const item
      of blocked
    ) {
      console.log('');
      console.log(
        `${item.className}`,
      );

      console.log(
        `  ${item.issue}`,
      );

      console.log(
        `  ${item.required}`,
      );
    }
  }

  if (
    internalOverlaps.length > 0 ||
    existingConflicts.length > 0
  ) {
    console.log('');
    console.log(
      '⚠️ Hay conflictos. No recomiendo importar estas tarifas todavía.',
    );
  }

  /* =======================================================
   * OUTPUT
   * ======================================================= */

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

    summary: {
      readyTariffs:
        ready.length,

      blockedClasses:
        blocked.length,

      ignoredClasses:
        ignored.length,

      internalOverlaps:
        internalOverlaps.length,

      existingConflicts:
        existingConflicts.length,
    },

    generalRatePeriods:
      GENERAL_RATE_PERIODS,

    ready,

    blocked,

    ignored,

    internalOverlaps,

    existingConflicts,
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

  const workbook =
    utils.book_new();

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      ready,
    ),
    'Tarifas listas',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      blocked,
    ),
    'Bloqueadas',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      ignored,
    ),
    'Mappings ignorados',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(
      existingConflicts.map(
        (item) => ({
          Clase:
            item.candidate.className,

          'Importe nuevo':
            item.candidate.amount,

          'Desde nuevo':
            item.candidate.validFrom,

          'Hasta nuevo':
            item.candidate.validTo,

          'Importe existente':
            item.existing.amount,

          'Desde existente':
            item.existing.validFrom,

          'Hasta existente':
            item.existing.validTo,
        }),
      ),
    ),
    'Conflictos',
  );

  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet([
      {
        Métrica:
          'Tarifas listas',

        Cantidad:
          ready.length,
      },
      {
        Métrica:
          'Clases bloqueadas',

        Cantidad:
          blocked.length,
      },
      {
        Métrica:
          'Mappings/ignoradas',

        Cantidad:
          ignored.length,
      },
      {
        Métrica:
          'Solapamientos internos',

        Cantidad:
          internalOverlaps.length,
      },
      {
        Métrica:
          'Conflictos existentes',

        Cantidad:
          existingConflicts.length,
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
    `📝 JSON: ${OUTPUT_JSON}`,
  );

  console.log(
    `📊 Excel: ${OUTPUT_XLSX}`,
  );

  console.log('');
  console.log(
    '✅ Build finalizado. No se modificó la BDD.',
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
        ? error.stack ??
          error.message
        : error,
    );

    process.exitCode =
      1;
  },
);