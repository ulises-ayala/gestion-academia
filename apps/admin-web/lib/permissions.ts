import type { AdminRoleDto } from '@academy/contracts';

export type UiPermission =
  | 'students:manage'
  | 'offering:read'
  | 'offering:manage'
  | 'tariffs:read'
  | 'tariffs:manage'
  | 'users:manage';

const byRole: Readonly<Record<AdminRoleDto, readonly UiPermission[]>> = {
  RECEPTION: ['students:manage', 'offering:read', 'tariffs:read'],
  MANAGER: [
    'students:manage',
    'offering:read',
    'offering:manage',
    'tariffs:read',
    'tariffs:manage',
    'users:manage',
  ],
  ADMINISTRATOR: [
    'students:manage',
    'offering:read',
    'offering:manage',
    'tariffs:read',
    'tariffs:manage',
    'users:manage',
  ],
};

export const roleLabel: Readonly<Record<AdminRoleDto, string>> = {
  RECEPTION: 'Admisión',
  MANAGER: 'Administración',
  ADMINISTRATOR: 'Dirección',
};
export const roleCan = (role: AdminRoleDto, permission: UiPermission) =>
  byRole[role].includes(permission);
