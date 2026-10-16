import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FilterToolbar, Pagination, Table, Tabs } from './data-display';

describe('data display primitives', () => {
  it('keeps native semantic containers for links, filters, data and pagination', () => {
    const html = renderToStaticMarkup(
      <>
        <Tabs aria-label="Secciones">
          <a href="/students">Alumnos</a>
        </Tabs>
        <FilterToolbar>
          <input aria-label="Buscar" />
        </FilterToolbar>
        <Table>
          <tbody>
            <tr>
              <td>Fila</td>
            </tr>
          </tbody>
        </Table>
        <Pagination aria-label="Páginas">
          <button type="button">Anterior</button>
        </Pagination>
      </>,
    );
    expect(html).toContain('<nav aria-label="Secciones"');
    expect(html).toContain('<form class="ui-filter-toolbar"');
    expect(html).toContain('<table class="ui-table"');
    expect(html).toContain('aria-label="Páginas"');
  });
});
