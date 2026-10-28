import { Prisma } from '@academy/database';
import { DomainError } from '../../shared/domain/domain-error';
import { normalizeMoney } from './billing';

export const HISTORICAL_DEBT_MAX_DESCRIPTION = 200;

/** Valida el monto (mayor a cero) y el detalle de una deuda histórica. */
export const validateHistoricalDebt = (
  input: Readonly<{ amount: unknown; description: unknown }>,
) => {
  const amount = normalizeMoney(typeof input.amount === 'string' ? input.amount.trim() : '');
  if (new Prisma.Decimal(amount).lessThanOrEqualTo(0))
    throw new DomainError('VALIDATION_ERROR', 'El monto de la deuda debe ser mayor a cero', {
      field: 'amount',
    });
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length < 3 || description.length > HISTORICAL_DEBT_MAX_DESCRIPTION)
    throw new DomainError(
      'VALIDATION_ERROR',
      `Indicá a qué corresponde la deuda (entre 3 y ${HISTORICAL_DEBT_MAX_DESCRIPTION} caracteres)`,
      { field: 'description' },
    );
  return { amount, description };
};

/**
 * La deuda histórica es anterior a todo lo que ya tiene el sistema: vence el primer día del mes
 * anterior al inicio de la inscripción. Así el cobro, que imputa de la más vieja a la más nueva,
 * la cancela primero.
 */
export const historicalDebtDates = (enrollmentStart: string) => {
  const [year, month] = enrollmentStart.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 2, 1));
  const day = date.toISOString().slice(0, 10);
  return { period: day, dueDate: day };
};
