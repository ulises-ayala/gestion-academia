import type { CardTypeDto } from '@academy/contracts';

/**
 * Recargo por pagar con tarjeta, en centésimos de punto (débito 4,04 %, crédito 7,80 %). Es solo
 * para mostrarlo antes de cobrar: el importe que vale lo calcula la API (`domain/card-surcharge.ts`).
 */
const basisPoints: Readonly<Record<CardTypeDto, bigint>> = { DEBIT: 404n, CREDIT: 780n };

export const cardTypeLabels: Readonly<Record<CardTypeDto, string>> = {
  DEBIT: 'Débito 4,04 %',
  CREDIT: 'Crédito 7,80 %',
};

/** Recargo de lo que se paga con tarjeta, en centavos, redondeado al centavo (mitad hacia arriba). */
export const cardSurchargePreviewCents = (cardCents: bigint, cardType: CardTypeDto) =>
  (cardCents * basisPoints[cardType] + 5_000n) / 10_000n;
