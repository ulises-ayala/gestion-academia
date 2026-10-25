import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildImportRecord,
  centsToDecimal,
  exclusionReasons,
  legacyReferenceFor,
  planImport,
  wallClockToUtc,
} from './controlfit-payment-import.mjs';

const zone = 'America/Buenos_Aires';

const movement = (overrides = {}) => ({
  sourceRow: 14,
  movementNumber: 1,
  dniNormalized: '12345678',
  activityText: 'Kizomba | 2 días por semana | Pago de cuota |  Período abonado: 10-JUN/10-JUL.',
  movementType: 'QUOTA',
  cost: 30000,
  total: 30000,
  paymentDateTime: '2026-06-01T17:51:00.000Z',
  paymentMethodRaw: 'Mercado Pago',
  paymentMethod: 'MERCADO_PAGO',
  paymentMethodSupported: true,
  periodStart: '2026-06-10',
  periodType: 'MONTHLY',
  chargePeriod: '2026-06',
  studentId: 'student-1',
  classId: 'class-1',
  enrollmentId: 'enrollment-1',
  tariffId: 'tariff-1',
  existingChargeId: null,
  flags: [],
  ...overrides,
});

describe('exclusionReasons', () => {
  it('accepts a resolved monthly quota payment', () => {
    assert.deepEqual(exclusionReasons(movement()), []);
  });

  it('accepts discounts, late fees and tariff differences', () => {
    const item = movement({
      total: 25000,
      flags: [{ code: 'TOTAL_BELOW_COST' }, { code: 'COST_DIFFERS_FROM_TARIFF' }],
    });
    assert.deepEqual(exclusionReasons(item), []);
  });

  it('excludes unresolved, weekly, duplicated and unknown alerts', () => {
    assert.ok(exclusionReasons(movement({ flags: [{ code: 'CLASS_NOT_RESOLVED' }] })).length);
    assert.ok(exclusionReasons(movement({ flags: [{ code: 'SOMETHING_NEW' }] })).length);
    assert.ok(exclusionReasons(movement({ periodType: 'WEEKLY', chargePeriod: null })).length);
    assert.ok(
      exclusionReasons(movement({ flags: [{ code: 'MULTIPLE_MOVEMENTS_SAME_PERIOD' }] })).length,
    );
  });

  it('excludes non quota movements and unsupported methods', () => {
    assert.ok(exclusionReasons(movement({ movementType: 'REGISTRATION' })).length);
    assert.ok(exclusionReasons(movement({ paymentMethodSupported: false })).length);
  });

  it('excludes totals above cost unless the difference is the ARS 1.000 late fee', () => {
    assert.deepEqual(exclusionReasons(movement({ total: 31000 })), []);
    assert.deepEqual(exclusionReasons(movement({ total: 32000 })), ['TOTAL_ABOVE_COST']);
  });

  it('excludes zero or missing amounts', () => {
    assert.deepEqual(exclusionReasons(movement({ total: 0 })), ['INVALID_AMOUNT']);
    assert.deepEqual(exclusionReasons(movement({ cost: null })), ['INVALID_AMOUNT']);
  });
});

describe('buildImportRecord', () => {
  it('keeps the cost as base and records the discount', () => {
    const record = buildImportRecord(movement({ total: 15000.5 }), zone);
    assert.equal(record.baseAmount, '30000.00');
    assert.equal(record.discountAmount, '14999.50');
    assert.equal(record.finalAmount, '15000.50');
    assert.equal(record.amount, '15000.50');
    assert.deepEqual(
      record.adjustments.map(({ type, amountCents }) => [type, amountCents]),
      [['HISTORICAL_DISCOUNT', 1_499_950]],
    );
  });

  it('records the ARS 1.000 surplus as late fee', () => {
    const record = buildImportRecord(movement({ total: 31000 }), zone);
    assert.equal(record.discountAmount, '0.00');
    assert.equal(record.finalAmount, '30000.00');
    assert.equal(record.amount, '31000.00');
    assert.deepEqual(
      record.adjustments.map(({ type }) => type),
      ['LATE_FEE'],
    );
  });

  it('uses the first day of the period and clamps the due date to day 10', () => {
    assert.equal(buildImportRecord(movement(), zone).period, '2026-06-01');
    assert.equal(buildImportRecord(movement(), zone).dueDate, '2026-06-10');
    assert.equal(
      buildImportRecord(movement({ periodStart: '2026-06-28' }), zone).dueDate,
      '2026-06-10',
    );
    assert.equal(
      buildImportRecord(movement({ periodStart: '2026-06-03' }), zone).dueDate,
      '2026-06-03',
    );
  });

  it('converts the local ControlFit time to UTC', () => {
    assert.equal(buildImportRecord(movement(), zone).paidAt, '2026-06-01T20:51:00.000Z');
  });
});

describe('wallClockToUtc', () => {
  it('keeps late evening payments on the same business day', () => {
    assert.equal(
      wallClockToUtc('2026-06-30T23:30:00.000Z', zone).toISOString(),
      '2026-07-01T02:30:00.000Z',
    );
  });
});

describe('legacyReferenceFor', () => {
  it('is stable and ignores the report row number', () => {
    assert.equal(
      legacyReferenceFor(movement()),
      legacyReferenceFor(movement({ sourceRow: 99, movementNumber: 80 })),
    );
    assert.notEqual(legacyReferenceFor(movement()), legacyReferenceFor(movement({ total: 1 })));
    assert.ok(legacyReferenceFor(movement()).length <= 80);
  });
});

describe('planImport', () => {
  it('excludes every movement that would land on the same charge', () => {
    const { records, excluded } = planImport(
      [
        movement({ sourceRow: 1 }),
        movement({
          sourceRow: 2,
          periodStart: '2026-06-25',
          paymentDateTime: '2026-06-25T10:00:00.000Z',
        }),
        movement({ sourceRow: 3, enrollmentId: 'enrollment-2' }),
      ],
      zone,
    );
    assert.deepEqual(
      records.map(({ sourceRow }) => sourceRow),
      [3],
    );
    assert.deepEqual(
      excluded.map(({ item, reasons }) => [item.sourceRow, reasons]),
      [
        [1, ['SAME_CHARGE_IN_REPORT']],
        [2, ['SAME_CHARGE_IN_REPORT']],
      ],
    );
  });

  it('excludes charges before the import range', () => {
    const { records, excluded } = planImport(
      [
        movement({ sourceRow: 1, chargePeriod: '2026-06' }),
        movement({ sourceRow: 2, chargePeriod: '2026-07', enrollmentId: 'enrollment-2' }),
      ],
      zone,
      '2026-07',
    );
    assert.deepEqual(
      records.map(({ sourceRow }) => sourceRow),
      [2],
    );
    assert.deepEqual(excluded[0].reasons, ['BEFORE_IMPORT_RANGE']);
  });
});

describe('centsToDecimal', () => {
  it('formats cents without floating point', () => {
    assert.equal(centsToDecimal(5), '0.05');
    assert.equal(centsToDecimal(3_000_000), '30000.00');
    assert.equal(centsToDecimal(-150), '-1.50');
  });
});
