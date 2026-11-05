import { describe, expect, it } from 'vitest';
import { PERMISSIONS_KEY } from '../../auth/presentation/permissions.decorator';
import { BillingAdjustmentsController } from './billing-adjustments.controller';

describe('BillingAdjustmentsController permissions', () => {
  it('deja el vencimiento a Admisión y el pase de cuota a Administración y Dirección', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, BillingAdjustmentsController.prototype.changeDueDate),
    ).toEqual(['charges:generate']);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, BillingAdjustmentsController.prototype.moveToEnrollment),
    ).toEqual(['charges:manage']);
  });

  it('deja actualizar el importe de una cuota solo a Administración y Dirección', () => {
    for (const handler of ['previewTariffUpdate', 'updateTariff'] as const)
      expect(
        Reflect.getMetadata(PERMISSIONS_KEY, BillingAdjustmentsController.prototype[handler]),
      ).toEqual(['charges:manage']);
  });
});
