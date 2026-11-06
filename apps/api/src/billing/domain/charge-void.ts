import { Prisma } from '@academy/database';
import { DomainError } from '../../shared/domain/domain-error';

/**
 * Anular una cuota generada por error (decisión 258): solo si no tiene nada imputado por pagos
 * confirmados (neto de reimputaciones). Si tiene pagos, primero se pasan a la cuota que
 * corresponde con Corregir → Cuotas; así el ingreso no se duplica ni cambia la caja.
 */
export const assertChargeVoidable = (
  charge: Readonly<{ status: string; paid: Prisma.Decimal }>,
) => {
  if (charge.status === 'VOID')
    throw new DomainError('MONTHLY_CHARGE_VOID_CONFLICT', 'La cuota ya está anulada');
  if (charge.paid.greaterThan(0))
    throw new DomainError(
      'MONTHLY_CHARGE_PAID_CONFLICT',
      'La cuota tiene pagos: pasalos a la cuota que corresponde (Corregir → Cuotas) y después anulala',
      { paidAmount: charge.paid.toFixed(2) },
    );
};
