import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS_KEY } from '../../auth/presentation/permissions.decorator';
import type { PaymentsService } from '../application/payments.service';
import type { ReceivablesService } from '../application/receivables.service';
import { PaymentsController } from './payments.controller';

const setup = () => {
  const list = vi.fn();
  const receivableList = vi.fn();
  const controller = new PaymentsController(
    { list } as unknown as PaymentsService,
    { list: receivableList } as unknown as ReceivablesService,
  );
  return { controller, list, receivableList };
};

describe('PaymentsController filters', () => {
  it('defaults receivables to pending, oldest and 25 items', () => {
    const { controller, receivableList } = setup();
    controller.receivableList();
    expect(receivableList).toHaveBeenCalledWith({
      scope: 'pending',
      sort: 'oldest',
      page: 1,
      pageSize: 25,
    });
  });

  it.each(['overdue', 'partial', 'unpaid'] as const)('accepts the %s receivables view', (scope) => {
    const { controller, receivableList } = setup();
    controller.receivableList(scope, ' Ana ', 'highest-debt', '2', '50');
    expect(receivableList).toHaveBeenCalledWith({
      scope,
      q: 'Ana',
      sort: 'highest-debt',
      page: 2,
      pageSize: 50,
    });
  });

  it('parses global payment search, status, tender and business dates', () => {
    const { controller, list } = setup();
    controller.list(
      undefined,
      'VOID',
      'MERCADO_PAGO',
      'Ana Pérez',
      '2026-08-01',
      '2026-08-31',
      '3',
      '25',
    );
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'VOID',
        paymentMethod: 'MERCADO_PAGO',
        q: 'Ana Pérez',
        page: 3,
        pageSize: 25,
        from: expect.any(Date),
        toExclusive: expect.any(Date),
      }),
    );
  });

  it('rejects invalid views, sort and dates', () => {
    const { controller } = setup();
    expect(() => controller.receivableList('paid')).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
    expect(() => controller.receivableList('pending', undefined, 'amount')).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
    expect(() =>
      controller.list(undefined, undefined, undefined, undefined, '2026-02-30'),
    ).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('keeps account reads and global history behind existing permissions', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, PaymentsController.prototype.receivableList),
    ).toEqual(['charges:read', 'payments:read']);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, PaymentsController.prototype.list)).toEqual([
      'payments:read',
    ]);
  });
});
