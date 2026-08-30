import type { AdminRoleDto } from '@academy/contracts';

export type UiPermission =
  | 'students:manage'
  | 'leads:manage'
  | 'enrollments:manage'
  | 'offering:read'
  | 'offering:manage'
  | 'tariffs:read'
  | 'tariffs:manage'
  | 'charges:read'
  | 'charges:manage'
  | 'payments:read'
  | 'payments:collect'
  | 'payments:void'
  | 'cash:manage'
  | 'cash:reconcile'
  | 'attendance:manage'
  | 'users:manage'
  | 'users:manage-direction'
  | 'inventory:sell'
  | 'inventory:manage'
  | 'trainings:register'
  | 'trainings:manage'
  | 'reports:operational'
  | 'reports:all'
  | 'settlements:manage'
  | 'settlements:approve'
  | 'audit:read';

const admissionPermissions: readonly UiPermission[] = [
  'students:manage',
  'leads:manage',
  'enrollments:manage',
  'offering:read',
  'tariffs:read',
  'charges:read',
  'payments:read',
  'payments:collect',
  'attendance:manage',
  'inventory:sell',
  'trainings:register',
];
const administrationPermissions: readonly UiPermission[] = [
  ...admissionPermissions,
  'offering:manage',
  'tariffs:manage',
  'charges:manage',
  'payments:void',
  'cash:manage',
  'cash:reconcile',
  'users:manage',
  'inventory:manage',
  'trainings:manage',
  'reports:operational',
  'settlements:manage',
  'audit:read',
];

const byRole: Readonly<Record<AdminRoleDto, readonly UiPermission[]>> = {
  RECEPTION: admissionPermissions,
  MANAGER: administrationPermissions,
  ADMINISTRATOR: [
    ...administrationPermissions,
    'users:manage-direction',
    'reports:all',
    'settlements:approve',
  ],
};

export const roleLabel: Readonly<Record<AdminRoleDto, string>> = {
  RECEPTION: 'Admisión',
  MANAGER: 'Administración',
  ADMINISTRATOR: 'Dirección',
};
export const roleCan = (role: AdminRoleDto, permission: UiPermission) =>
  byRole[role].includes(permission);
