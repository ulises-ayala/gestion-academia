'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import type { UiPermission } from '../lib/permissions';
import { roleLabel } from '../lib/permissions';

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const { user, can, logout } = useAuth();
  const pathname = usePathname();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const navigation: ReadonlyArray<{
    label: string;
    links: ReadonlyArray<{ href: string; label: string; permission: UiPermission }>;
  }> = [
    {
      label: 'Gestión',
      links: [
        { href: '/', label: 'Inicio', permission: 'students:manage' },
        { href: '/students', label: 'Alumnos', permission: 'students:manage' },
        { href: '/leads', label: 'Potenciales', permission: 'leads:manage' },
        { href: '/attendances', label: 'Asistencias', permission: 'attendance:manage' },
        { href: '/classes', label: 'Clases', permission: 'offering:read' },
        { href: '/teachers', label: 'Profesores', permission: 'offering:manage' },
      ],
    },
    {
      label: 'Finanzas',
      links: [
        { href: '/payments', label: 'Pagos', permission: 'payments:read' },
        { href: '/cash', label: 'Caja', permission: 'cash:manage' },
      ],
    },
    {
      label: 'Configuración',
      links: [
        { href: '/dance-types', label: 'Tipos de danza', permission: 'offering:manage' },
        { href: '/branches', label: 'Sucursales', permission: 'offering:manage' },
        { href: '/rooms', label: 'Salones', permission: 'offering:manage' },
        { href: '/tariffs', label: 'Tarifas', permission: 'tariffs:read' },
      ],
    },
    {
      label: 'Administración',
      links: [
        { href: '/users', label: 'Usuarios', permission: 'users:manage-direction' },
        { href: '/audit', label: 'Auditoría', permission: 'audit:read' },
      ],
    },
  ];
  const initials = user.username.slice(0, 2).toUpperCase();

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('academy-theme');
    const initialTheme =
      storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('academy-theme', nextTheme);
  };

  return (
    <div className="admin-layout">
      <aside className={`sidebar ${navigationOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link className="brand" href="/" onClick={() => setNavigationOpen(false)}>
            <span className="brand-mark" aria-hidden="true">
              GA
            </span>
            <span>
              Gestión
              <small>Academia</small>
            </span>
          </Link>
          <button
            aria-label="Cerrar navegación"
            className="sidebar-close secondary"
            onClick={() => setNavigationOpen(false)}
            type="button"
          >
            ×
          </button>
        </div>
        <nav aria-label="Módulos" className="sidebar-nav">
          {navigation.map((group) => {
            const visibleLinks = group.links.filter((link) => can(link.permission));
            if (visibleLinks.length === 0) return null;
            return (
              <div className="nav-group" key={group.label}>
                <p className="nav-group-label">{group.label}</p>
                {visibleLinks.map((link) => (
                  <Link
                    key={link.href}
                    className={`nav-link ${link.href === '/' ? (pathname === '/' ? 'active' : '') : pathname.startsWith(link.href) ? 'active' : ''}`}
                    href={link.href}
                    onClick={() => setNavigationOpen(false)}
                  >
                    <span className="nav-indicator" aria-hidden="true" />
                    {link.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        <p className="sidebar-footer">Panel administrativo</p>
      </aside>
      {navigationOpen && (
        <button
          aria-label="Cerrar navegación"
          className="sidebar-backdrop"
          onClick={() => setNavigationOpen(false)}
          type="button"
        />
      )}
      <div className="admin-content">
        <header className="topbar">
          <button
            aria-expanded={navigationOpen}
            aria-label="Abrir navegación"
            className="menu-button secondary"
            onClick={() => setNavigationOpen(true)}
            type="button"
          >
            <span aria-hidden="true">☰</span>
          </button>
          <div className="topbar-spacer" />
          <button
            aria-label={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
            className="theme-toggle secondary"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
            type="button"
          >
            <span aria-hidden="true">{theme === 'light' ? '◐' : '○'}</span>
          </button>
          <div className="user-context">
            <span className="user-avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="user-badge">
              <strong>{user.username}</strong>
              <small>{roleLabel[user.role]}</small>
            </span>
          </div>
          <button className="secondary" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
