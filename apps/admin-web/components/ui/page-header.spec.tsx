import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('keeps the title semantic and accepts descriptive text and real actions', () => {
    const html = renderToStaticMarkup(
      <PageHeader
        title="Alumnos"
        description="Gestioná alumnos y sus clases"
        actions={<a href="/students/new">Nuevo alumno</a>}
      />,
    );
    expect(html).toContain('<h1>Alumnos</h1>');
    expect(html).toContain('Gestioná alumnos y sus clases');
    expect(html).toContain('<a href="/students/new">Nuevo alumno</a>');
  });

  it('does not render empty optional containers', () => {
    const html = renderToStaticMarkup(<PageHeader title="Inicio" />);
    expect(html).not.toContain('page-header-actions');
    expect(html).not.toContain('<p>');
  });
});
