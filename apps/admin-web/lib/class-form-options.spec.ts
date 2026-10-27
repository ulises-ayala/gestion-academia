import { describe, expect, it } from 'vitest';
import { opensInEditMode, withCurrentOption } from './class-form-options';

describe('edición de clases', () => {
  it('muestra el profesor o la danza actual aunque esté inactivo', () => {
    const active = [{ id: 'a', label: 'Barrios, Jose Luis' }];
    expect(withCurrentOption(active, { id: 'a', label: 'Barrios, Jose Luis' })).toBe(active);
    expect(withCurrentOption(active, { id: 'b', label: 'Ruiz, Valentina' })).toEqual([
      { id: 'b', label: 'Ruiz, Valentina (inactivo)' },
      ...active,
    ]);
    expect(withCurrentOption(active, null)).toBe(active);
  });
  it('abre la clase en edición desde el listado', () => {
    expect(opensInEditMode('?editar=1')).toBe(true);
    expect(opensInEditMode('')).toBe(false);
  });
});
