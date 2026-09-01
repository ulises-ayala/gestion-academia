import type { PaymentMethodDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { DomainError } from '../../shared/domain/domain-error';

export const CASH_METHODS: readonly PaymentMethodDto[] = ['CASH', 'MERCADO_PAGO', 'CARD'];
export const zeroByMethod = () => ({
  CASH: new Prisma.Decimal(0),
  MERCADO_PAGO: new Prisma.Decimal(0),
  CARD: new Prisma.Decimal(0),
});
export const cashTotals = (
  movements: readonly {
    type: 'COLLECTION' | 'REVERSAL';
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
export const parseCashAmount = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(value))
    throw new DomainError('VALIDATION_ERROR', 'El importe debe ser un decimal no negativo', {
      field,
    });
  return new Prisma.Decimal(value);
};
