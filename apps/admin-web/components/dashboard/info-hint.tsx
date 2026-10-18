'use client';

import { Info } from 'lucide-react';
import React, { useId } from 'react';

/** Ayuda breve junto a un indicador. Se muestra al pasar el mouse o al enfocar. */
export function InfoHint({ label, text }: Readonly<{ label: string; text: string }>) {
  const id = useId();
  return (
    <span className="info-hint">
      <button aria-describedby={id} aria-label={`Qué incluye ${label}`} type="button">
        <Info aria-hidden="true" size={14} strokeWidth={1.75} />
      </button>
      <span className="info-hint-text" id={id} role="tooltip">
        {text}
      </span>
    </span>
  );
}
