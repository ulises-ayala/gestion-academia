import { Prisma } from '@academy/database';
import { DomainError } from '../../shared/domain/domain-error';

type Decimal = Prisma.Decimal;
const zero = () => new Prisma.Decimal(0);
const cents = (value: Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const HUNDRED = new Prisma.Decimal(100);

/** Reparto de una clase vigente desde un mes (AAAA-MM). Lo que no se reparte es de la academia. */
export type SettlementPlan = Readonly<{
  classId: string;
  validFrom: string;
  shares: readonly Readonly<{ teacherId: string; percentage: Decimal }>[];
}>;

/** Lo cobrado de una cuota en el mes (una imputación de un pago). */
export type ChargeIncome = Readonly<{
  paymentId: string;
  paidAt: Date;
  studentName: string;
  classId: string;
  className: string;
  chargeKind: 'MONTHLY' | 'HISTORICAL_DEBT';
  /** Mes de la cuota (AAAA-MM): define qué reparto se usa (el profesor a cargo en ese mes). */
  chargePeriod: string;
  collected: Decimal;
  /** Lo que debe pagar el alumno y la base del profesor (difieren con la beca de Dirección). */
  studentDue: Decimal;
  settlementBase: Decimal;
}>;

/** Una clase suelta cobrada en el mes, con el profesor que la dictó. */
export type SingleClassIncome = Readonly<{
  paymentId: string;
  paidAt: Date;
  studentName: string;
  classId: string;
  className: string;
  teacherId: string;
  collected: Decimal;
}>;

export type SettlementLine = Readonly<{
  paymentId: string;
  paidAt: Date;
  studentName: string;
  className: string;
  concept: 'MONTHLY' | 'HISTORICAL_DEBT' | 'SINGLE_CLASS';
  chargePeriod: string | null;
  collected: Decimal;
  base: Decimal;
  percentage: Decimal;
  amount: Decimal;
}>;

export type SettlementResult = Readonly<{
  collected: Decimal;
  classIncome: Decimal;
  otherIncome: Decimal;
  teachersTotal: Decimal;
  academy: Decimal;
  teachers: readonly Readonly<{ teacherId: string; total: Decimal; lines: SettlementLine[] }>[];
  /** Clases con cobros y sin reparto para ese mes: lo cobrado queda en la academia. */
  unconfigured: readonly Readonly<{
    classId: string;
    className: string;
    period: string;
    collected: Decimal;
  }>[];
}>;

/** El reparto que rige en un mes: el de "desde" más reciente que no lo supere. */
export const planFor = (plans: readonly SettlementPlan[], classId: string, period: string) =>
  plans
    .filter((plan) => plan.classId === classId && plan.validFrom <= period)
    .reduce<SettlementPlan | null>(
      (latest, plan) => (!latest || plan.validFrom > latest.validFrom ? plan : latest),
      null,
    );

/**
 * Base del profesor por lo cobrado de una cuota. La beca de Dirección la absorbe la academia: el
 * alumno paga menos pero el profesor cobra sobre la cuota completa (decisión 132). El descuento
 * docente sí baja la base. Se reparte en proporción a lo cobrado (pago parcial = base parcial).
 */
export const chargeSettlementBase = (
  income: Pick<ChargeIncome, 'collected' | 'studentDue' | 'settlementBase'>,
) =>
  income.studentDue.greaterThan(0)
    ? cents(income.collected.times(income.settlementBase).dividedBy(income.studentDue))
    : income.collected;

/**
 * Liquidación por criterio de caja (decisión 229): todo lo cobrado en el mes, aunque sea de una
 * cuota de un mes anterior. Cada cuota se reparte con el reparto vigente en el mes de la cuota
 * (el profesor que estaba a cargo); la clase suelta, con el del mes del cobro.
 */
export const computeSettlement = (input: {
  charges: readonly ChargeIncome[];
  singleClasses: readonly SingleClassIncome[];
  otherIncome: Decimal;
  plans: readonly SettlementPlan[];
  period: string;
}): SettlementResult => {
  const teachers = new Map<string, { total: Decimal; lines: SettlementLine[] }>();
  const unconfigured = new Map<
    string,
    { classId: string; className: string; period: string; collected: Decimal }
  >();
  let classIncome = zero();
  let teachersTotal = zero();
  const pay = (teacherId: string, line: SettlementLine) => {
    const entry = teachers.get(teacherId) ?? { total: zero(), lines: [] };
    entry.total = entry.total.plus(line.amount);
    entry.lines.push(line);
    teachers.set(teacherId, entry);
    teachersTotal = teachersTotal.plus(line.amount);
  };
  const missing = (classId: string, className: string, period: string, collected: Decimal) => {
    const key = `${classId}:${period}`;
    const entry = unconfigured.get(key) ?? { classId, className, period, collected: zero() };
    entry.collected = entry.collected.plus(collected);
    unconfigured.set(key, entry);
  };

  for (const income of input.charges) {
    classIncome = classIncome.plus(income.collected);
    const plan = planFor(input.plans, income.classId, income.chargePeriod);
    if (!plan || plan.shares.length === 0) {
      if (!plan) missing(income.classId, income.className, income.chargePeriod, income.collected);
      continue;
    }
    const base = chargeSettlementBase(income);
    for (const share of plan.shares)
      pay(share.teacherId, {
        paymentId: income.paymentId,
        paidAt: income.paidAt,
        studentName: income.studentName,
        className: income.className,
        concept: income.chargeKind,
        chargePeriod: income.chargePeriod,
        collected: income.collected,
        base,
        percentage: share.percentage,
        amount: cents(base.times(share.percentage).dividedBy(HUNDRED)),
      });
  }

  for (const income of input.singleClasses) {
    classIncome = classIncome.plus(income.collected);
    const plan = planFor(input.plans, income.classId, input.period);
    if (!plan || plan.shares.length === 0) {
      if (!plan) missing(income.classId, income.className, input.period, income.collected);
      continue;
    }
    const line = (percentage: Decimal) => ({
      paymentId: income.paymentId,
      paidAt: income.paidAt,
      studentName: income.studentName,
      className: income.className,
      concept: 'SINGLE_CLASS' as const,
      chargePeriod: null,
      collected: income.collected,
      base: income.collected,
      percentage,
      amount: cents(income.collected.times(percentage).dividedBy(HUNDRED)),
    });
    // Si la dictó uno de los profesores del reparto, se reparte igual que la cuota; si la dio un
    // reemplazo, se lleva la parte de todos los profesores de la clase.
    if (plan.shares.some((share) => share.teacherId === income.teacherId))
      for (const share of plan.shares) pay(share.teacherId, line(share.percentage));
    else
      pay(
        income.teacherId,
        line(plan.shares.reduce((sum, share) => sum.plus(share.percentage), zero())),
      );
  }

  const collected = classIncome.plus(input.otherIncome);
  return {
    collected,
    classIncome,
    otherIncome: input.otherIncome,
    teachersTotal,
    academy: collected.minus(teachersTotal),
    teachers: [...teachers.entries()].map(([teacherId, entry]) => ({ teacherId, ...entry })),
    unconfigured: [...unconfigured.values()],
  };
};

/** Valida un reparto: profesores sin repetir, cada uno entre 0 y 100 y en total hasta 100. */
export const validateShares = (
  shares: readonly Readonly<{ teacherId?: unknown; percentage?: unknown }>[] | undefined,
) => {
  if (!Array.isArray(shares))
    throw new DomainError('VALIDATION_ERROR', 'El reparto no es válido', { field: 'shares' });
  const seen = new Set<string>();
  const parsed = shares.map((share) => {
    if (typeof share?.teacherId !== 'string' || !share.teacherId)
      throw new DomainError('VALIDATION_ERROR', 'Falta el profesor', { field: 'shares' });
    if (seen.has(share.teacherId))
      throw new DomainError('VALIDATION_ERROR', 'Un profesor figura dos veces en el reparto', {
        field: 'shares',
      });
    seen.add(share.teacherId);
    const text = String(share.percentage ?? '').replace(',', '.');
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(text))
      throw new DomainError('VALIDATION_ERROR', 'El porcentaje no es válido', { field: 'shares' });
    const percentage = new Prisma.Decimal(text);
    if (percentage.lessThanOrEqualTo(0) || percentage.greaterThan(100))
      throw new DomainError('VALIDATION_ERROR', 'Cada porcentaje va de 0 a 100', {
        field: 'shares',
      });
    return { teacherId: share.teacherId, percentage };
  });
  const total = parsed.reduce((sum, share) => sum.plus(share.percentage), zero());
  if (total.greaterThan(100))
    throw new DomainError('VALIDATION_ERROR', 'Los porcentajes suman más de 100', {
      field: 'shares',
    });
  return parsed;
};
