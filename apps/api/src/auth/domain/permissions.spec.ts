import { describe, expect, it } from 'vitest';
import type { PublicAuthUser } from '../application/auth.repository';
import { hasPermissions } from './permissions';

const user = (role: PublicAuthUser['role']): PublicAuthUser => ({
  id: crypto.randomUUID(),
  username: role.toLowerCase(),
  role,
  status: 'ACTIVE',
});

describe('role permissions', () => {
  it('Admisión gestiona alumnos pero no configuración, caja ni usuarios', () => {
    expect(hasPermissions(user('RECEPTION'), ['students:manage', 'offering:read'])).toBe(true);
    expect(hasPermissions(user('RECEPTION'), ['offering:manage'])).toBe(false);
    expect(hasPermissions(user('RECEPTION'), ['cash:manage'])).toBe(false);
    expect(hasPermissions(user('RECEPTION'), ['users:manage'])).toBe(false);
  });
  it('Administración gestiona operación sensible pero no Dirección', () => {
    expect(
      hasPermissions(user('MANAGER'), ['offering:manage', 'cash:manage', 'settlements:manage']),
    ).toBe(true);
    expect(hasPermissions(user('MANAGER'), ['users:manage-direction'])).toBe(false);
    expect(hasPermissions(user('MANAGER'), ['settlements:approve'])).toBe(false);
  });
  it('Dirección posee permisos completos', () => {
    expect(
      hasPermissions(user('ADMINISTRATOR'), [
        'users:manage-direction',
        'reports:all',
        'settlements:approve',
      ]),
    ).toBe(true);
  });
});
