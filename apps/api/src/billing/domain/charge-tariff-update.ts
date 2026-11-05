import { Prisma } from '@academy/database';
import { DomainError } from '../../shared/domain/domain-error';

type ChargeForTariffUpdate = Readonly<{
  kind: string;
  status: string;
  tariffId: string | null;
  baseAmount: Prisma.Decimal;
  /** Lo imputado por pagos confirmados (neto de reimputaciones). */
  paid: Prisma.Decimal;
  adjustments: readonly Readonly<{ id: string; reversalOfId: string | null }>[];
}>;

/**
 * Actualizar una cuota a la modalidad de la inscripción (decisión 257): solo una cuota mensual
 * pendiente, sin nada pagado y sin becas, descuentos ni recargo vigentes. Con pagos o ajustes el
 * importe ya se usó para imputar o calcular, y cambiarlo reescribiría la historia.
 */
export const assertTariffUpdatable = (
  charge: ChargeForTariffUpdate,
  tariff: Readonly<{ id: string; amount: Prisma.Decimal }>,
) => {
  if (charge.kind !== 'MONTHLY' || charge.status !== 'PENDING')
    throw new DomainError(
      'CHARGE_TARIFF_NOT_EDITABLE',
      'Solo se puede actualizar el importe de una cuota mensual pendiente',
    );
  if (charge.paid.greaterThan(0))
    throw new DomainError(
      'CHARGE_TARIFF_NOT_EDITABLE',
      'La cuota ya tiene pagos: corregí o reimputá el pago y después actualizá el importe',
    );
  const reversed = new Set(charge.adjustments.flatMap(({ reversalOfId }) => reversalOfId ?? []));
  const active = charge.adjustments.filter(
    ({ id, reversalOfId }) => !reversalOfId && !reversed.has(id),
  );
  if (active.length > 0)
    throw new DomainError(
      'CHARGE_TARIFF_NOT_EDITABLE',
      'La cuota tiene becas, descuentos o recargo: no se puede actualizar el importe',
    );
  if (charge.tariffId === tariff.id && charge.baseAmount.equals(tariff.amount))
    throw new DomainError(
      'CHARGE_TARIFF_UNCHANGED',
      'La cuota ya tiene el importe de la modalidad de la inscripción',
    );
};
