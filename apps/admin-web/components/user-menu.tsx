'use client';

import { ChevronDown, LogOut } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

type UserMenuProps = Readonly<{
  username: string;
  roleLabel: string;
  onLogout(): void;
}>;

export const userInitial = (username: string) => username.trim().charAt(0).toUpperCase() || '?';

const displayName = (username: string) =>
  `${username.charAt(0).toLocaleUpperCase('es-AR')}${username.slice(1)}`;

export function UserMenu({ username, roleLabel, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const items = () => [...(root?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    items()[0]?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (root && !root.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const list = items();
      const current = list.indexOf(document.activeElement as HTMLElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      list[(current + step + list.length) % list.length]?.focus();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    root?.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      root?.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const runAndClose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Cuenta de ${username}`}
        className="user-menu-trigger"
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
        type="button"
      >
        <span className="user-menu-avatar" aria-hidden="true">
          {userInitial(username)}
        </span>
        <span className="user-menu-identity">
          <strong>{displayName(username)}</strong>
          <small>{roleLabel}</small>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="user-menu-chevron"
          size={16}
          strokeWidth={1.75}
        />
      </button>
      {open && (
        <div aria-label="Opciones de cuenta" className="user-menu-panel" id={menuId} role="menu">
          <div className="user-menu-heading" aria-hidden="true">
            <strong>{displayName(username)}</strong>
            <small>{roleLabel}</small>
          </div>
          <button
            className="user-menu-item"
            onClick={() => runAndClose(onLogout)}
            role="menuitem"
            type="button"
          >
            <LogOut aria-hidden="true" size={16} strokeWidth={1.75} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
