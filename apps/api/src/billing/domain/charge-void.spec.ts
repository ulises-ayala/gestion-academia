import { Prisma } from '@academy/database';
import { describe, expect, it } from 'vitest';
import { assertChargeVoidable } from './charge-void';

const d = (value: string) => new Prisma.Decimal(value);

describe('anular una cuota', () => {
  it('solo sin nada pagado y si no estaba anulada', () => {
    expect(() => assertChargeVoidable({ status: 'PENDING', paid: d('0') })).not.toThrow();
    expect(() => assertChargeVoidable({ status: 'PARTIAL', paid: d('15000') })).toThrow(
      expect.objectContaining({
        code: 'MONTHLY_CHARGE_PAID_CONFLICT',
        details: { paidAmount: '15000.00' },
      }),
    );
    expect(() => assertChargeVoidable({ status: 'VOID', paid: d('0') })).toThrow(
      expect.objectContaining({ code: 'MONTHLY_CHARGE_VOID_CONFLICT' }),
    );
  });
});
