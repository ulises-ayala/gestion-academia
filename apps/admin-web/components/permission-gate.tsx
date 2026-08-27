'use client';

import type { ReactNode } from 'react';
import type { UiPermission } from '../lib/permissions';
import { useAuth } from './auth-provider';

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: Readonly<{ permission: UiPermission; children: ReactNode; fallback?: ReactNode }>) {
  return useAuth().can(permission) ? children : fallback;
}

export function RequirePermission({
  permission,
  children,
}: Readonly<{ permission: UiPermission; children: ReactNode }>) {
  const { can } = useAuth();
  if (can(permission)) return children;
  return (
    <section className="card">
      <p className="eyebrow">Acceso restringido</p>
      <h1>Sin permiso</h1>
      <p>Tu nivel de acceso no permite consultar esta sección.</p>
    </section>
  );
}
