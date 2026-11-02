import { describe, expect, it } from 'vitest';
import { classTeachersLabel } from './offering';
import { additionalTeacherOptions, opensInEditMode, withCurrentOption } from './class-form-options';

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
  it('ofrece como adicionales a los activos menos el responsable, y conserva los inactivos', () => {
    const active = [
      { id: 'f', label: 'Gómez, Fernando' },
      { id: 's', label: 'López, Sofía' },
    ];
    expect(additionalTeacherOptions(active, [], 'f')).toEqual([{ id: 's', label: 'López, Sofía' }]);
    expect(additionalTeacherOptions(active, [{ id: 'a', label: 'Paz, Anabella' }], 'f')).toEqual([
      { id: 'a', label: 'Paz, Anabella (inactivo)' },
      { id: 's', label: 'López, Sofía' },
    ]);
  });
  it('lista primero al responsable y después a los adicionales', () => {
    expect(
      classTeachersLabel({
        teacher: { id: 'f', firstName: 'Fernando', lastName: 'Gómez' },
        additionalTeachers: [
          { id: 's', firstName: 'Sofía', lastName: 'López' },
          { id: 'a', firstName: 'Anabella', lastName: 'Paz' },
        ],
      }),
    ).toBe('Fernando Gómez, Sofía López, Anabella Paz');
  });
});
