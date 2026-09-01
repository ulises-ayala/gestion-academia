import { Prisma } from '@academy/database';
import { DomainError } from '../../shared/domain/domain-error';

export const LATE_FEE_AMOUNT = new Prisma.Decimal(1000);
type AdjustmentType =
  | 'DIRECTION_SCHOLARSHIP'
  | 'TEACHER_SCHOLARSHIP'
  | 'TEACHER_DISCOUNT'
  | 'LATE_FEE'
  | 'REVERSAL';
type Calculation = 'PERCENTAGE' | 'FIXED';

export const parseBillingPeriod = (value: string, field = 'effectiveFrom') => {
  if (!/^\d{4}-\d{2}$/.test(value))
    throw new DomainError('VALIDATION_ERROR', `${field} debe tener formato AAAA-MM`, { field });
  const date = new Date(`${value}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 7) !== value)
    throw new DomainError('VALIDATION_ERROR', `${field} no es un perÃ­odo vÃ¡lido`, { field });
  return date;
};

export const validateCondition = (input: {
  type: AdjustmentType;
  calculation?: Calculation;
  configuredValue?: string;
}) => {
  if (!['DIRECTION_SCHOLARSHIP', 'TEACHER_SCHOLARSHIP', 'TEACHER_DISCOUNT'].includes(input.type))
    throw new DomainError('VALIDATION_ERROR', 'El tipo de ajuste no es válido', { field: 'type' });
  const scholarship = input.type !== 'TEACHER_DISCOUNT';
  const calculation = scholarship ? ('PERCENTAGE' as const) : input.calculation;
  let value: Prisma.Decimal;
  try {
    value = scholarship ? new Prisma.Decimal(100) : new Prisma.Decimal(input.configuredValue ?? 0);
  } catch {
    throw new DomainError('VALIDATION_ERROR', 'El valor del ajuste no es válido', {
      field: 'configuredValue',
    });
  }
  if (
    !calculation ||
    value.lessThanOrEqualTo(0) ||
    (calculation === 'PERCENTAGE' && value.greaterThan(100))
  )
    throw new DomainError('VALIDATION_ERROR', 'El valor del ajuste no es vÃ¡lido', {
      field: 'configuredValue',
    });
  return { calculation, configuredValue: value };
};

export const conditionDeltas = (
  base: Prisma.Decimal,
  condition: { type: AdjustmentType; calculation: Calculation; configuredValue: Prisma.Decimal },
) => {
  const amount = Prisma.Decimal.min(
    condition.calculation === 'PERCENTAGE'
      ? base.mul(condition.configuredValue).div(100).toDecimalPlaces(2)
      : condition.configuredValue,
    base,
  );
  return {
    effectiveAmount: amount,
    studentAmountDelta: amount.negated(),
    settlementBaseDelta:
      condition.type === 'DIRECTION_SCHOLARSHIP' ? new Prisma.Decimal(0) : amount.negated(),
  };
};

export const adjustedAmounts = (
  base: Prisma.Decimal,
  adjustments: readonly {
    studentAmountDelta: Prisma.Decimal;
    settlementBaseDelta: Prisma.Decimal;
  }[],
) => ({
  studentDue: Prisma.Decimal.max(
    adjustments.reduce((sum, item) => sum.plus(item.studentAmountDelta), base),
    0,
  ),
  settlementBase: Prisma.Decimal.max(
    adjustments.reduce((sum, item) => sum.plus(item.settlementBaseDelta), base),
    0,
  ),
});

export const chargeStatus = (paid: Prisma.Decimal, due: Prisma.Decimal, voided = false) =>
  voided
    ? ('VOID' as const)
    : due.minus(paid).lessThanOrEqualTo(0)
      ? ('PAID' as const)
      : paid.isZero()
        ? ('PENDING' as const)
        : ('PARTIAL' as const);
