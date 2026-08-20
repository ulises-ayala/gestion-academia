'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from './auth-provider';

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const links = [{ href: '/students', label: 'Alumnos' }, { href: '/teachers', label: 'Profesores' }, { href: '/classes', label: 'Clases' }, { href: '/dance-types', label: 'Tipos de danza' }, { href: '/branches', label: 'Sucursales' }, { href: '/rooms', label: 'Salones' }];
  return <div className="admin-layout">
    <aside className="sidebar">
      <Link className="brand" href="/students">Gestión Academia</Link>
      <nav aria-label="Módulos">{links.map((link) => <Link key={link.href} className={`nav-link ${pathname.startsWith(link.href) ? 'active' : ''}`} href={link.href}>{link.label}</Link>)}</nav>
    </aside>
    <div className="admin-content">
      <header className="topbar"><span className="user-badge">{user.username}</span><button className="secondary" onClick={() => void logout()}>Cerrar sesión</button></header>
      <main>{children}</main>
    </div>
  </div>;
}
