'use client';

import type { LeadListDto, StudentListDto } from '@academy/contracts';
import { ArrowRight, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../lib/api-client';
import {
  QUICK_SEARCH_LIMIT,
  QUICK_SEARCH_MIN_LENGTH,
  buildQuickSearchGroups,
  moveSelection,
  type QuickSearchSection,
} from '../lib/quick-search';

type Props = Readonly<{
  sections: readonly QuickSearchSection[];
  canSearchStudents: boolean;
  canSearchLeads: boolean;
}>;

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export function QuickSearch({ sections, canSearchStudents, canSearchLeads }: Props) {
  const router = useRouter();
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<StudentListDto['items']>([]);
  const [leads, setLeads] = useState<LeadListDto['items']>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setStudents([]);
    setLeads([]);
    setFailed(false);
    triggerRef.current?.focus();
  }, []);

  // Atajos: Ctrl/Cmd + K en cualquier momento, "/" cuando no se está escribiendo.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      const slash = event.key === '/' && !isTypingTarget(event.target);
      if (!shortcut && !slash) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Búsqueda con espera breve para no consultar en cada tecla.
  useEffect(() => {
    const text = query.trim();
    setSelected(0);
    if (!open || text.length < QUICK_SEARCH_MIN_LENGTH) {
      setStudents([]);
      setLeads([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    const request = ++requestRef.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      const params = `q=${encodeURIComponent(text)}&page=1&pageSize=${QUICK_SEARCH_LIMIT}`;
      void Promise.allSettled([
        canSearchStudents
          ? apiRequest<StudentListDto>(`/students?${params}`)
          : Promise.resolve({ items: [] }),
        canSearchLeads
          ? apiRequest<LeadListDto>(`/leads?${params}`)
          : Promise.resolve({ items: [] }),
      ]).then(([studentResult, leadResult]) => {
        if (request !== requestRef.current) return;
        setStudents(studentResult.status === 'fulfilled' ? studentResult.value.items : []);
        setLeads(leadResult.status === 'fulfilled' ? leadResult.value.items : []);
        setFailed(studentResult.status === 'rejected' || leadResult.status === 'rejected');
        setLoading(false);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, open, canSearchStudents, canSearchLeads]);

  const groups = useMemo(
    () => buildQuickSearchGroups(query, sections, students, leads),
    [query, sections, students, leads],
  );
  const items = groups.flatMap((group) => group.items);
  const active = items[selected];

  const go = (href: string) => {
    close();
    router.push(href);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((current) =>
        moveSelection(current, event.key === 'ArrowDown' ? 1 : -1, items.length),
      );
    } else if (event.key === 'Enter' && active) {
      event.preventDefault();
      go(active.href);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  const hasText = query.trim().length >= QUICK_SEARCH_MIN_LENGTH;
  let index = -1;

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-label="Buscar alumnos, potenciales o secciones"
        className="quick-search-trigger"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <Search aria-hidden="true" size={17} strokeWidth={1.75} />
        <span className="quick-search-trigger-label">Buscar…</span>
        <kbd className="quick-search-kbd">Ctrl K</kbd>
      </button>
      {open && (
        <div className="quick-search-backdrop" onMouseDown={close} role="presentation">
          <div
            aria-label="Búsqueda rápida"
            aria-modal="true"
            className="quick-search-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="quick-search-field">
              <Search aria-hidden="true" size={18} strokeWidth={1.75} />
              <input
                aria-activedescendant={active ? `${listId}-${active.id}` : undefined}
                aria-autocomplete="list"
                aria-controls={listId}
                aria-expanded={items.length > 0}
                aria-label="Buscar por nombre, DNI, teléfono o sección"
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Nombre, DNI, teléfono o sección…"
                ref={inputRef}
                role="combobox"
                spellCheck={false}
                enterKeyHint="search"
                type="text"
                value={query}
              />
              <button
                aria-label="Cerrar búsqueda"
                className="quick-search-close"
                onClick={close}
                type="button"
              >
                <X aria-hidden="true" size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="quick-search-results" id={listId} role="listbox">
              {groups.map((group) => (
                <div
                  className="quick-search-group"
                  key={group.label}
                  role="group"
                  aria-label={group.label}
                >
                  <p className="quick-search-group-label" aria-hidden="true">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    index += 1;
                    const position = index;
                    return (
                      <div
                        aria-selected={position === selected}
                        className={`quick-search-item ${position === selected ? 'is-active' : ''} ${item.muted ? 'is-muted' : ''}`}
                        id={`${listId}-${item.id}`}
                        key={item.id}
                        onClick={() => go(item.href)}
                        onMouseMove={() => setSelected(position)}
                        role="option"
                      >
                        <span className="quick-search-item-text">
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </span>
                        <ArrowRight aria-hidden="true" size={15} strokeWidth={1.75} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="quick-search-status" role="status">
              {loading
                ? 'Buscando…'
                : failed
                  ? 'No se pudo completar la búsqueda. Probá de nuevo.'
                  : hasText && items.length === 0
                    ? `No hay resultados para “${query.trim()}”.`
                    : !hasText
                      ? 'Escribí al menos 2 letras para buscar alumnos y potenciales.'
                      : `${items.length} resultados · ↑↓ para elegir · Enter para abrir`}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
