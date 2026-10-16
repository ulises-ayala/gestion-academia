import { describe, expect, it } from 'vitest';
import { isNavigationLinkActive, sectionLabelForPath } from './admin-shell';

describe('Admin shell navigation', () => {
  it('does not mark Inicio active on nested routes', () => {
    expect(isNavigationLinkActive('/', '/')).toBe(true);
    expect(isNavigationLinkActive('/students', '/')).toBe(false);
  });

  it('keeps nested screens associated with their module', () => {
    expect(isNavigationLinkActive('/students/student-1', '/students')).toBe(true);
    expect(sectionLabelForPath('/students/student-1')).toBe('Alumnos');
    expect(sectionLabelForPath('/payments')).toBe('Pagos');
  });

  it('uses a stable fallback for an unknown path', () => {
    expect(sectionLabelForPath('/not-found')).toBe('Gestión Academia');
  });
});
