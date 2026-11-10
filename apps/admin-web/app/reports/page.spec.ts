import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// La página (período, pestañas y carga) y sus secciones.
const page = ['./page.tsx', '../../components/reports/report-sections.tsx', '../../lib/reports.ts']
  .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n');
const shell = readFileSync(new URL('../../components/admin-shell.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

describe('Reports page', () => {
  it('expone tabs, filtros URL, exports y estados operativos', () => {
    for (const label of [
      'Resumen',
      'Alumnos',
      'Cobros',
      'Profesores',
      'Deudores',
      'Asistencia',
      'Caja',
    ])
      expect(page).toContain(label);
    expect(page).toContain('`/reports/operational?${params}`');
    expect(page).toContain('/reports/export/');
    expect(page).toContain('`${apiUrl}/reports/pdf?${params}`');
    expect(page).toContain('Descargar PDF');
    expect(page).toContain('No pudimos cargar este reporte.');
    expect(page).toContain('Los valores reflejan la situación actual');
  });

  it('muestra Reportes sólo con reports:operational', () => {
    expect(shell).toMatch(
      /href:\s*'\/reports',[\s\S]*?label:\s*'Reportes',[\s\S]*?permission:\s*'reports:operational'/,
    );
  });

  it('incluye adaptación móvil sin depender de una tabla horizontal', () => {
    expect(styles).toMatch(/@media \(max-width: 48rem\)[\s\S]*\.reports-metrics/);
    expect(page).toContain('data-label="Alumno"');
    expect(page).toContain('role="tablist"');
  });
});
