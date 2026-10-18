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
import { UserMenu } from './user-menu';

type NavigationLink = Readonly<{
  href: string;
  label: string;
  permission: UiPermission;
  icon: LucideIcon;
}>;

type NavigationGroup = Readonly<{
  label: string;
  placement: 'primary' | 'secondary';
  links: readonly NavigationLink[];
}>;

const navigation: readonly NavigationGroup[] = [
  {
    label: 'Gestión',
    placement: 'primary',
    links: [
      { href: '/', label: 'Inicio', permission: 'students:manage', icon: LayoutDashboard },
      { href: '/students', label: 'Alumnos', permission: 'students:manage', icon: Users },
      { href: '/payments', label: 'Pagos', permission: 'payments:read', icon: CreditCard },
      { href: '/cash', label: 'Caja', permission: 'cash:manage', icon: Wallet },
      {
        href: '/attendances',
        label: 'Asistencias',
        permission: 'attendance:manage',
        icon: CalendarCheck,
      },
      { href: '/leads', label: 'Potenciales', permission: 'leads:manage', icon: UserPlus },
      { href: '/classes', label: 'Clases', permission: 'offering:read', icon: CalendarDays },
      {
        href: '/teachers',
        label: 'Profesores',
        permission: 'offering:manage',
        icon: GraduationCap,
      },
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
    placement: 'secondary',
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
    placement: 'secondary',
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
    const menuButton = menuButtonRef.current;
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [navigationOpen]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('academy-theme', nextTheme);
  };

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
            <span className="brand-copy">
              <span className="brand-name">Carmesí</span>
              <span className="brand-tagline">Academia de danza</span>
            </span>
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
          {(['primary', 'secondary'] as const).map((placement) => {
            const groups = navigation
              .filter((group) => group.placement === placement)
              .map((group) => ({
                ...group,
                links: group.links.filter((link) => can(link.permission)),
              }))
              .filter((group) => group.links.length > 0);
            if (groups.length === 0) return null;
            return (
              <div className={`nav-section nav-section--${placement}`} key={placement}>
                {groups.map((group) => (
                  <div className="nav-group" key={group.label}>
                    <p className={`nav-group-label ${placement === 'primary' ? 'sr-only' : ''}`}>
                      {group.label}
                    </p>
                    <div className="nav-group-links">
                      {group.links.map((link) => {
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
                            <Icon
                              aria-hidden="true"
                              className="nav-icon"
                              size={19}
                              strokeWidth={1.6}
                            />
                            <span>{link.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </nav>
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
          <div className="topbar-actions">
            <button
              aria-label={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
              aria-pressed={theme === 'dark'}
              className="shell-icon-button theme-toggle-button"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
              type="button"
            >
              {theme === 'light' ? (
                <Moon aria-hidden="true" size={18} strokeWidth={1.6} />
              ) : (
                <Sun aria-hidden="true" size={18} strokeWidth={1.6} />
              )}
            </button>
            <UserMenu
              onLogout={() => void logout()}
              roleLabel={roleLabel[user.role]}
              username={user.username}
            />
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
