import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import { Input, Select, Textarea } from './form-controls';
import { Badge, EmptyState, Panel, Skeleton } from './feedback';

describe('Shared native UI controls', () => {
  it('keeps actions as real buttons, with explicit form submission', () => {
    expect(renderToStaticMarkup(<Button>Cancelar</Button>)).toContain('type="button"');
    const html = renderToStaticMarkup(
      <Button type="submit" name="intent" value="save">
        Guardar
      </Button>,
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="save"');
  });

  it('forwards event handlers and refs without wrapping business actions', () => {
    const onClick = vi.fn();
    const ref = React.createRef<HTMLButtonElement>();
    const element = Button({ children: 'Cancelar', onClick, ref });
    expect(element.props.onClick).toBe(onClick);
    expect(element.props.ref).toBe(ref);
  });

  it.each(['primary', 'secondary', 'ghost', 'destructive'] as const)(
    'preserves disabled and accessible naming in %s buttons',
    (variant) => {
      const html = renderToStaticMarkup(
        <Button variant={variant} disabled aria-label="Cerrar">
          ×
        </Button>,
      );
      expect(html).toContain('disabled=""');
      expect(html).toContain('aria-label="Cerrar"');
    },
  );

  it('announces loading, prevents duplicate clicks and keeps the supplied message', () => {
    const html = renderToStaticMarkup(<Button loading>Guardando…</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Guardando…');
    expect(renderToStaticMarkup(<Button>Guardar</Button>)).not.toContain('disabled=""');
  });

  it.each([
    <Input
      id="field"
      label="Nombre"
      helpText="Ayuda"
      error="Revisá el valor"
      aria-describedby="external"
    />,
    <Select
      id="field"
      label="Motivo"
      helpText="Ayuda"
      error="Revisá el valor"
      aria-describedby="external"
    >
      <option>Otro</option>
    </Select>,
    <Textarea
      id="field"
      label="Observación"
      helpText="Ayuda"
      error="Revisá el valor"
      aria-describedby="external"
    />,
  ])(
    'associates labels, help and errors without dropping external descriptions (%#)',
    (control) => {
      const html = renderToStaticMarkup(control);
      expect(html).toContain('for="field"');
      expect(html).toContain('id="field"');
      expect(html).toContain('aria-describedby="external field-help field-error"');
      expect(html).toContain('id="field-help"');
      expect(html).toContain('id="field-error"');
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('Revisá el valor');
    },
  );

  it('preserves native constraints, values, selection and disabled state', () => {
    const input = renderToStaticMarkup(
      <Input
        id="date"
        label="Fecha"
        type="date"
        min="2026-01-01"
        defaultValue="2026-02-01"
        required
        disabled
      />,
    );
    expect(input).toContain('type="date"');
    expect(input).toContain('min="2026-01-01"');
    expect(input).toContain('value="2026-02-01"');
    expect(input).toContain('required=""');
    expect(input).toContain('disabled=""');
    expect(input).not.toContain('aria-invalid');
    expect(input).not.toContain('aria-describedby');
    const select = renderToStaticMarkup(
      <Select id="reason" label="Motivo" defaultValue="OTHER" autoFocus required>
        <option value="OTHER">Otro</option>
      </Select>,
    );
    expect(select).toContain('selected=""');
    expect(select).toContain('autofocus=""');
    expect(select).toContain('required=""');
    const textarea = renderToStaticMarkup(
      <Textarea
        id="note"
        label="Observación"
        rows={3}
        maxLength={500}
        defaultValue="Sin cambios"
        aria-invalid
      />,
    );
    expect(textarea).toContain('rows="3"');
    expect(textarea).toContain('maxLength="500"');
    expect(textarea).toContain('Sin cambios');
    expect(textarea).toContain('aria-invalid="true"');
  });

  it('keeps state text, section semantics and real links; skeletons stay decorative', () => {
    const html = renderToStaticMarkup(
      <Panel aria-labelledby="title">
        <h2 id="title">Alumnos</h2>
        <Badge tone="success">Activo</Badge>
        <EmptyState>
          <p>No hay resultados</p>
          <a href="/students">Ver alumnos</a>
        </EmptyState>
        <Skeleton />
      </Panel>,
    );
    expect(html).toContain('<section');
    expect(html).toContain('aria-labelledby="title"');
    expect(html).toContain('Activo');
    expect(html).toContain('No hay resultados');
    expect(html).toContain('<a href="/students">Ver alumnos</a>');
    expect(html).toContain('aria-hidden="true"');
  });
});
