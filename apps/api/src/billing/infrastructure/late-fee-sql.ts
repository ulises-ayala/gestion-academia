import { Prisma } from '@academy/database';

/**
 * Versión SQL de la condición "nace vencida" de `lateFeeApplies`: la cuota se creó (día de
 * negocio) después de su vencimiento y por eso no lleva recargo (decisión 202).
 */
export const bornOverdueSql = (alias: 'mc') => Prisma.sql`
  ((${Prisma.raw(alias)}.created_at AT TIME ZONE ${
    process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires'
  })::date > ${Prisma.raw(alias)}.due_date)`;
