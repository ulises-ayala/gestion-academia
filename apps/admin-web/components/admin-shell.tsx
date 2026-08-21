'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from './auth-provider';
import type { UiPermission } from '../lib/permissions';
import { roleLabel } from '../lib/permissions';

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const { user, can, logout } = useAuth();
  const pathname = usePathname();
  const links: { href: string; label: string; permission: UiPermission }[] = [
    { href: '/students', label: 'Alumnos', permission: 'students:manage' },
    { href: '/classes', label: 'Clases', permission: 'offering:read' },
    { href: '/teachers', label: 'Profesores', permission: 'offering:manage' },
    { href: '/dance-types', label: 'Tipos de danza', permission: 'offering:manage' },
    { href: '/branches', label: 'Sucursales', permission: 'offering:manage' },
    { href: '/rooms', label: 'Salones', permission: 'offering:manage' },
    { href: '/tariffs', label: 'Tarifas', permission: 'tariffs:read' },
    { href: '/users', label: 'Usuarios', permission: 'users:manage' },
  ];
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <Link className="brand" href="/students">
          Gestión Academia
        </Link>
        <nav aria-label="Módulos">
          {links
            .filter((link) => can(link.permission))
            .map((link) => (
              <Link
                key={link.href}
                className={`nav-link ${pathname.startsWith(link.href) ? 'active' : ''}`}
                href={link.href}
              >
                {link.label}
              </Link>
            ))}
        </nav>
      </aside>
      <div className="admin-content">
        <header className="topbar">
          <span className="user-badge">
            {user.username} · {roleLabel[user.role]}
          </span>
          <button className="secondary" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
