import { describe, expect, it } from 'vitest';
import { rolePermissions } from '../../auth/domain/permissions';
import { PERMISSIONS_KEY } from '../../auth/presentation/permissions.decorator';
import { CashHandoversController } from './cash-handovers.controller';

describe('Entregas de efectivo: límites de autorización', () => {
  const prototype = CashHandoversController.prototype as unknown as Record<string, object>;
  const handlers = Object.getOwnPropertyNames(CashHandoversController.prototype).filter(
    (name) => name !== 'constructor',
  );

  it('todas las acciones exigen cash:reconcile', () => {
    expect(handlers.sort()).toEqual(['cashCollected', 'create', 'list', 'void']);
    for (const name of handlers)
      expect(Reflect.getMetadata(PERMISSIONS_KEY, prototype[name]!)).toEqual(['cash:reconcile']);
  });

  it('Administración y Dirección pueden; Admisión no', () => {
    expect(rolePermissions.RECEPTION).not.toContain('cash:reconcile');
    expect(rolePermissions.MANAGER).toContain('cash:reconcile');
    expect(rolePermissions.ADMINISTRATOR).toContain('cash:reconcile');
  });
});
