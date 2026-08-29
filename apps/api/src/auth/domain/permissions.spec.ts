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
  it('Admisión consulta facturación y cobra cuotas, sin administrar economía ni caja', () => {
    const reception = user('RECEPTION');

    expect(hasPermissions(reception, ['tariffs:read'])).toBe(true);
    expect(hasPermissions(reception, ['tariffs:manage'])).toBe(false);
    expect(hasPermissions(reception, ['charges:read'])).toBe(true);
    expect(hasPermissions(reception, ['charges:manage'])).toBe(false);
    expect(hasPermissions(reception, ['payments:read'])).toBe(true);
    expect(hasPermissions(reception, ['payments:collect'])).toBe(true);
    expect(hasPermissions(reception, ['payments:void'])).toBe(false);
    expect(hasPermissions(reception, ['cash:manage'])).toBe(false);
    expect(hasPermissions(reception, ['cash:reconcile'])).toBe(false);
    expect(hasPermissions(reception, ['audit:read'])).toBe(false);
  });
  it('Administración gestiona tarifas, cuotas, pagos y caja', () => {
    const manager = user('MANAGER');

    expect(
      hasPermissions(manager, [
        'tariffs:manage',
        'charges:manage',
        'payments:read',
        'payments:collect',
        'payments:void',
        'cash:manage',
        'cash:reconcile',
      ]),
    ).toBe(true);
    expect(hasPermissions(manager, ['users:manage-direction'])).toBe(false);
    expect(hasPermissions(manager, ['settlements:approve'])).toBe(false);
    expect(hasPermissions(manager, ['audit:read'])).toBe(true);
  });
  it('Dirección conserva la matriz de Administración y sus capacidades sensibles', () => {
    expect(
      hasPermissions(user('ADMINISTRATOR'), [
        'tariffs:manage',
        'charges:manage',
        'payments:read',
        'payments:collect',
        'payments:void',
        'cash:manage',
        'cash:reconcile',
        'users:manage-direction',
        'reports:all',
        'settlements:approve',
        'audit:read',
      ]),
    ).toBe(true);
  });
});
