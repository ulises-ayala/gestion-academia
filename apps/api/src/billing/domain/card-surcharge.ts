import type { CardTypeDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { DomainError } from '../../shared/domain/domain-error';

/**
 * Recargo por pagar con tarjeta (PO, 03/11/2026): débito 4,04 % y crédito 7,80 % sobre lo que se
 * paga con tarjeta. La web repite estos valores en `lib/card-surcharge.ts`.
 */
export const CARD_SURCHARGE_RATES: Readonly<Record<CardTypeDto, Prisma.Decimal>> = {
  DEBIT: new Prisma.Decimal('4.04'),
  CREDIT: new Prisma.Decimal('7.80'),
};
const labels: Readonly<Record<CardTypeDto, string>> = {
  DEBIT: 'Débito 4,04 %',
  CREDIT: 'Crédito 7,80 %',
};

/** Valida el tipo de tarjeta del cobro: null si no se indicó. */
export const parseCardType = (value: unknown): CardTypeDto | null => {
  if (value === undefined || value === null || value === '') return null;
  if (value !== 'DEBIT' && value !== 'CREDIT')
    throw new DomainError('VALIDATION_ERROR', 'Elegí si la tarjeta es de débito o de crédito', {
      field: 'cardType',
    });
  return value;
};

/**
 * Recargo de lo que se paga con tarjeta, redondeado al centavo. Exige que el cobro tenga tarjeta.
 * Devuelve null si el importe con tarjeta da un recargo de cero.
 */
export const cardSurchargeFor = (
  tenders: readonly Readonly<{ method: string; amount: string }>[],
  cardType: CardTypeDto,
) => {
  const card = tenders.find((tender) => tender.method === 'CARD');
  if (!card)
    throw new DomainError(
      'VALIDATION_ERROR',
      'El recargo por tarjeta solo va si se paga con tarjeta',
      {
        field: 'cardType',
      },
    );
  const amount = new Prisma.Decimal(card.amount)
    .times(CARD_SURCHARGE_RATES[cardType])
    .dividedBy(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return amount.isZero() ? null : { amount: amount.toFixed(2), detail: labels[cardType] };
};
