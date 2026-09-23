import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../components/admin-shell.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

describe('Reports page', () => {
  it('expone tabs, filtros URL, exports y estados operativos', () => {
    for (const label of ['Resumen', 'Alumnos', 'Cobros y deuda', 'Asistencia', 'Caja'])
      expect(page).toContain(label);
    expect(page).toContain('`/reports/operational?${params}`');
    expect(page).toContain('/reports/export/');
    expect(page).toContain('No pudimos cargar este reporte.');
    expect(page).toContain('Los valores reflejan la situación actual');
  });

  it('muestra Reportes sólo con reports:operational', () => {
    expect(shell).toContain(
      "href: '/reports', label: 'Reportes', permission: 'reports:operational'",
    );
  });

  it('incluye adaptación móvil sin depender de una tabla horizontal', () => {
    expect(styles).toMatch(/@media \(max-width: 48rem\)[\s\S]*\.reports-metrics/);
    expect(page).toContain('data-label="Alumno"');
    expect(page).toContain('role="tablist"');
  });
});
