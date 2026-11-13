'use client';

import type { LeadDto, LeadListDto } from '@academy/contracts';
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api-client';
import { leadStatusLabels } from '../lib/leads';

/**
 * Busca entre los potenciales alumnos abiertos a quien vino a una clase de prueba, para inscribirlo
 * con sus datos en lugar de cargarlos de nuevo.
 */
export function LeadPicker({ onPick }: Readonly<{ onPick(lead: LeadDto): void }>) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<readonly LeadDto[]>([]);
  const [searched, setSearched] = useState('');
  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) {
      setItems([]);
      setSearched('');
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: term, status: 'OPEN', pageSize: '5' });
      apiRequest<LeadListDto>(`/leads?${params}`)
        .then((result) => {
          if (cancelled) return;
          setItems(result.items);
          setSearched(term);
        })
        .catch(() => !cancelled && setItems([]));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term]);

  return (
    <section className="card lead-picker" aria-labelledby="lead-picker-title">
      <h2 id="lead-picker-title">¿Ya vino a una clase de prueba?</h2>
      <p className="subtitle">Buscalo entre los potenciales alumnos para usar sus datos.</p>
      <label>
        Buscar
        <input
          placeholder="Nombre o teléfono"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {items.length > 0 && (
        <ul>
          {items.map((lead) => (
            <li key={lead.id}>
              <button className="secondary" type="button" onClick={() => onPick(lead)}>
                <strong>{lead.name}</strong>
                <span>
                  {[lead.phone, leadStatusLabels[lead.status]].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && searched === term && items.length === 0 && (
        <p className="subtitle">No hay potenciales abiertos con ese nombre o teléfono.</p>
      )}
    </section>
  );
}
