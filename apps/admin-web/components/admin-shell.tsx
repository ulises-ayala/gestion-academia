'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from './auth-provider';

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const { user, logout } = useAuth();
  return <div className="admin-layout">
    <aside className="sidebar">
      <Link className="brand" href="/students">Gestión Academia</Link>
      <nav aria-label="Módulos"><Link className="nav-link active" href="/students">Alumnos</Link></nav>
    </aside>
    <div className="admin-content">
      <header className="topbar"><span className="user-badge">{user.username}</span><button className="secondary" onClick={() => void logout()}>Cerrar sesión</button></header>
      <main>{children}</main>
    </div>
  </div>;
}
