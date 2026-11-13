import type { ClassDto } from '@academy/contracts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LeadPicker } from './lead-picker';
import { TrialVisitForm } from './trial-visit-form';

const classes = [
  { id: 'c1', name: 'Salsa inicial', danceType: { name: 'Salsa' } },
  { id: 'c2', name: 'Kizomba', danceType: { name: 'Kizomba' } },
] as ClassDto[];

describe('Clase de prueba desde Nuevo alumno', () => {
  it('pide quién viene, la clase y el día, sin datos de alumno ni cobro', () => {
    const html = renderToStaticMarkup(<TrialVisitForm classes={classes} loadingClasses={false} />);
    for (const text of [
      'Quién viene',
      'Nombre',
      'Teléfono',
      'Cómo llegó',
      'Clase de prueba',
      'Día',
    ])
      expect(html).toContain(text);
    expect(html).toContain('<option value="c1">Salsa inicial · Salsa</option>');
    expect(html).toContain('una sola vez por clase');
    expect(html).toContain('Registrar clase de prueba');
    expect(html).not.toMatch(/DNI|Tarifa|Medio de pago|Cuotas iniciales/);
  });

  it('avisa mientras cargan las clases', () => {
    const html = renderToStaticMarkup(<TrialVisitForm classes={[]} loadingClasses />);
    expect(html).toContain('Cargando clases…');
  });

  it('ofrece buscar entre los potenciales a quien vuelve', () => {
    const html = renderToStaticMarkup(<LeadPicker onPick={() => undefined} />);
    expect(html).toContain('¿Ya vino a una clase de prueba?');
    expect(html).toContain('placeholder="Nombre o teléfono"');
  });
});
