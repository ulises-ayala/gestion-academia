import type { PaymentMethodDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { DomainError } from '../../shared/domain/domain-error';

export const CASH_METHODS: readonly PaymentMethodDto[] = [
  'CASH',
  'MERCADO_PAGO',
  'TRANSFER',
  'CARD',
];
export const zeroByMethod = () => ({
  CASH: new Prisma.Decimal(0),
  MERCADO_PAGO: new Prisma.Decimal(0),
  TRANSFER: new Prisma.Decimal(0),
  CARD: new Prisma.Decimal(0),
});
export const cashTotals = (
  movements: readonly {
    /** Las reversas (anulaciones) y las devoluciones de saldo a favor restan. */
    type: 'COLLECTION' | 'REVERSAL' | 'REFUND';
    method: PaymentMethodDto;
    amount: Prisma.Decimal;
  }[],
) => {
  const totals = zeroByMethod();
  for (const movement of movements)
    totals[movement.method] = totals[movement.method].plus(
      movement.type === 'COLLECTION' ? movement.amount : movement.amount.negated(),
    );
  return totals;
};
/**
 * Línea de cierre de un medio. Los turnos cerrados antes de que existiera un medio (por ejemplo,
 * transferencia) no la tienen: cuenta como cero.
 */
export const closingLineFor = <
  T extends {
    method: PaymentMethodDto;
    expectedAmount: Prisma.Decimal;
    declaredAmount: Prisma.Decimal;
  },
>(
  lines: readonly T[],
  method: PaymentMethodDto,
) =>
  lines.find((line) => line.method === method) ?? {
    method,
    expectedAmount: new Prisma.Decimal(0),
    declaredAmount: new Prisma.Decimal(0),
    differenceAmount: new Prisma.Decimal(0),
  };
export const parseCashAmount = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(value))
    throw new DomainError('VALIDATION_ERROR', 'El importe debe ser un decimal no negativo', {
      field,
    });
  return new Prisma.Decimal(value);
};
