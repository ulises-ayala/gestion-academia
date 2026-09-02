import type { PublicAuthUser } from '../application/auth.repository';

export type Permission =
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

const admissionPermissions: readonly Permission[] = [
  'students:manage',
  'leads:manage',
  'enrollments:manage',
  'offering:read',
  'tariffs:read',
  'charges:read',
  'payments:read',
  'payments:collect',
  'cash:manage',
  'attendance:manage',
  'inventory:sell',
  'trainings:register',
];
const administrationPermissions: readonly Permission[] = [
  ...admissionPermissions,
  'offering:manage',
  'tariffs:manage',
  'charges:manage',
  'payments:void',
  'cash:reconcile',
  'inventory:manage',
  'trainings:manage',
  'reports:operational',
  'settlements:manage',
  'audit:read',
];

export const rolePermissions: Readonly<Record<PublicAuthUser['role'], readonly Permission[]>> = {
  RECEPTION: admissionPermissions,
  MANAGER: administrationPermissions,
  ADMINISTRATOR: [
    ...administrationPermissions,
    'users:manage',
    'users:manage-direction',
    'reports:all',
    'settlements:approve',
  ],
};

export const hasPermissions = (user: PublicAuthUser, required: readonly Permission[]) =>
  required.every((permission) => rolePermissions[user.role].includes(permission));
