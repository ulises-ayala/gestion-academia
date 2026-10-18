import { describe, expect, it } from 'vitest';
import { documentTitleForPath, isNavigationLinkActive, sectionLabelForPath } from './admin-shell';

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
    expect(sectionLabelForPath('/not-found')).toBe('Carmesí');
  });

  it('names the browser tab after the current section', () => {
    expect(documentTitleForPath('/payments')).toBe('Pagos · Carmesí');
    expect(documentTitleForPath('/students/student-1')).toBe('Alumnos · Carmesí');
    expect(documentTitleForPath('/not-found')).toBe('Carmesí · Academia de danza');
  });
});
