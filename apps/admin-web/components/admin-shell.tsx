'use client';

import {
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  DoorOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Music,
  ReceiptText,
  ShieldCheck,
  Sun,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { UiPermission } from '../lib/permissions';
import { roleLabel } from '../lib/permissions';
import { useAuth } from './auth-provider';

type NavigationLink = Readonly<{
  href: string;
  label: string;
  permission: UiPermission;
  icon: LucideIcon;
}>;

const navigation: ReadonlyArray<{ label: string; links: readonly NavigationLink[] }> = [
  {
    label: 'Gestión',
    links: [
      { href: '/', label: 'Inicio', permission: 'students:manage', icon: LayoutDashboard },
      { href: '/students', label: 'Alumnos', permission: 'students:manage', icon: Users },
      { href: '/leads', label: 'Potenciales', permission: 'leads:manage', icon: UserPlus },
      {
        href: '/attendances',
        label: 'Asistencias',
        permission: 'attendance:manage',
        icon: CalendarCheck,
      },
      { href: '/classes', label: 'Clases', permission: 'offering:read', icon: CalendarDays },
      {
        href: '/teachers',
        label: 'Profesores',
        permission: 'offering:manage',
        icon: GraduationCap,
      },
    ],
  },
  {
    label: 'Finanzas',
    links: [
      { href: '/payments', label: 'Pagos', permission: 'payments:read', icon: CreditCard },
      { href: '/cash', label: 'Caja', permission: 'cash:manage', icon: Wallet },
      {
        href: '/reports',
        label: 'Reportes',
        permission: 'reports:operational',
        icon: BarChart3,
      },
    ],
  },
  {
    label: 'Configuración',
    links: [
      {
        href: '/dance-types',
        label: 'Tipos de danza',
        permission: 'offering:manage',
        icon: Music,
      },
      {
        href: '/branches',
        label: 'Sucursales',
        permission: 'offering:manage',
        icon: Building2,
      },
      { href: '/rooms', label: 'Salones', permission: 'offering:manage', icon: DoorOpen },
      { href: '/tariffs', label: 'Tarifas', permission: 'tariffs:read', icon: ReceiptText },
    ],
  },
  {
    label: 'Administración',
    links: [
      {
        href: '/users',
        label: 'Usuarios',
        permission: 'users:manage-direction',
        icon: UserCog,
      },
      { href: '/audit', label: 'Auditoría', permission: 'audit:read', icon: ShieldCheck },
    ],
  },
];

export const isNavigationLinkActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

export const sectionLabelForPath = (pathname: string) =>
  navigation
    .flatMap((group) => group.links)
    .find((link) => isNavigationLinkActive(pathname, link.href))?.label ?? 'Gestión Academia';

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const { user, can, logout } = useAuth();
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const initials = user.username.slice(0, 2).toUpperCase();
  const sectionLabel = sectionLabelForPath(pathname);

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

  useEffect(() => setNavigationOpen(false), [pathname]);

  useEffect(() => {
    if (!navigationOpen) return;
    const sidebar = sidebarRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar?.querySelector<HTMLElement>('[data-drawer-close]')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setNavigationOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !sidebar) return;
      const focusable = [
        ...sidebar.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)'),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButtonRef.current?.focus();
    };
  }, [navigationOpen]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('academy-theme', nextTheme);
  };

  const themeLabel = theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro';
  const ThemeIcon = theme === 'light' ? Moon : Sun;

  const accountControls = (mobile = false) => (
    <div className={mobile ? 'mobile-account-controls' : 'sidebar-account-actions'}>
      <button
        aria-label={themeLabel}
        className="shell-icon-button"
        onClick={toggleTheme}
        title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
        type="button"
      >
        <ThemeIcon aria-hidden="true" size={16} strokeWidth={1.5} />
      </button>
      <button
        aria-label="Cerrar sesión"
        className="shell-icon-button"
        onClick={() => void logout()}
        title="Cerrar sesión"
        type="button"
      >
        <LogOut aria-hidden="true" size={16} strokeWidth={1.5} />
      </button>
    </div>
  );

  return (
    <div className="admin-layout">
      <aside
        aria-label="Navegación principal"
        aria-modal={navigationOpen || undefined}
        className={`sidebar ${navigationOpen ? 'open' : ''}`}
        ref={sidebarRef}
        role={navigationOpen ? 'dialog' : undefined}
      >
        <div className="sidebar-header">
          <Link className="brand" href="/" onClick={() => setNavigationOpen(false)}>
            <span className="brand-mark" aria-hidden="true">
              GA
            </span>
            <span className="brand-name">Gestión Academia</span>
          </Link>
          <button
            aria-label="Cerrar navegación"
            className="sidebar-close shell-icon-button"
            data-drawer-close
            onClick={() => setNavigationOpen(false)}
            type="button"
          >
            <X aria-hidden="true" size={18} strokeWidth={1.5} />
          </button>
        </div>
        <nav aria-label="Módulos" className="sidebar-nav">
          {navigation.map((group) => {
            const visibleLinks = group.links.filter((link) => can(link.permission));
            if (visibleLinks.length === 0) return null;
            return (
              <div className="nav-group" key={group.label}>
                <p className="nav-group-label">{group.label}</p>
                <div className="nav-group-links">
                  {visibleLinks.map((link) => {
                    const Icon = link.icon;
                    const active = isNavigationLinkActive(pathname, link.href);
                    return (
                      <Link
                        aria-current={active ? 'page' : undefined}
                        className={`nav-link ${active ? 'active' : ''}`}
                        href={link.href}
                        key={link.href}
                        onClick={() => setNavigationOpen(false)}
                      >
                        <span className="nav-active-indicator" aria-hidden="true" />
                        <Icon aria-hidden="true" className="nav-icon" size={16} strokeWidth={1.5} />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-account">
          <span className="user-avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="user-badge">
            <strong>{user.username}</strong>
            <small>{roleLabel[user.role]}</small>
          </span>
          {accountControls()}
        </div>
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
            className="menu-button shell-icon-button"
            onClick={() => setNavigationOpen(true)}
            ref={menuButtonRef}
            type="button"
          >
            <Menu aria-hidden="true" size={19} strokeWidth={1.5} />
          </button>
          <p className="topbar-section">{sectionLabel}</p>
          {accountControls(true)}
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
