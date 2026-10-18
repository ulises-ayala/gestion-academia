import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Pilot readiness critical screens', () => {
  it('mantiene loading, vacío específico y reintento en Alumnos y Potenciales', () => {
    const students = read('./students/page.tsx');
    const leads = read('./leads/page.tsx');
    expect(students).toContain('Cargando alumnos…');
    expect(students).toContain('No hay alumnos con estos filtros.');
    expect(students).toContain('Reintentar');
    expect(leads).toContain('Cargando potenciales…');
    expect(leads).toContain('No encontramos potenciales con esos filtros.');
    expect(leads).toContain('Reintentar');
  });

  it('preserva la fecha de Asistencia en la URL', () => {
    const attendance = read('./attendances/page.tsx');
    expect(attendance).toContain("url.searchParams.set('date', nextDate)");
    expect(attendance).toContain("window.history.pushState({}, '', url)");
    expect(attendance).toContain('Cargando clases...');
    expect(attendance).toContain('No hay clases programadas para este día.');
  });

  it('prioriza Asistencias antes de Oferta en la navegación', () => {
    const sidebar = read('../components/admin-shell.tsx');
    expect(sidebar.indexOf("label: 'Asistencias'")).toBeLessThan(
      sidebar.indexOf("label: 'Clases'"),
    );
  });

  // El Inicio se verifica renderizando sus paneles: components/dashboard/dashboard-panels.spec.tsx.

  it('no bloquea clases y tarifas si falla la consulta de caja durante el alta', () => {
    const onboarding = read('./students/new/page.tsx');
    expect(onboarding).toContain('const [classList, activeTariffs] = await Promise.all');
    const requiredOptionsLoad = onboarding.slice(
      onboarding.indexOf('const loadOptions'),
      onboarding.indexOf('useEffect(() =>'),
    );
    expect(requiredOptionsLoad).not.toContain('/cash-shifts/current');
    expect(onboarding).toContain('onClick={() => void loadOptions()}');
    expect(onboarding).toContain('Cargando clases y tarifas…');
  });
});
