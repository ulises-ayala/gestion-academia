import { describe, expect, it } from 'vitest';
import { rolePermissions } from '../../auth/domain/permissions';
import { PERMISSIONS_KEY } from '../../auth/presentation/permissions.decorator';
import { ClosingsController } from './closings.controller';

describe('Cierres: límites de autorización', () => {
  it('todas las acciones exigen cash:reconcile (Administración y Dirección)', () => {
    const prototype = ClosingsController.prototype as unknown as Record<string, object>;
    const handlers = Object.getOwnPropertyNames(ClosingsController.prototype).filter(
      (name) => name !== 'constructor',
    );
    expect(handlers.sort()).toEqual(['create', 'get', 'list', 'pdf', 'preview']);
    for (const name of handlers)
      expect(Reflect.getMetadata(PERMISSIONS_KEY, prototype[name]!)).toEqual(['cash:reconcile']);
    expect(rolePermissions.RECEPTION).not.toContain('cash:reconcile');
    expect(rolePermissions.ADMINISTRATOR).toContain('cash:reconcile');
  });
});
