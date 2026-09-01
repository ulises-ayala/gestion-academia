import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

describe('Cash page', () => {
  it('expone apertura, cierre por medio, movimientos e historial en español', () => {
    expect(page).toContain('No tenés un turno de caja abierto.');
    expect(page).toContain('Esperado según cobros');
    expect(page).toContain('Declarado');
    expect(page).toContain('Diferencia');
    expect(page).toContain('Movimientos');
    expect(page).toContain('Cierres');
    expect(page).toContain('Consolidado');
  });

  it('muestra cierre original, estado corregido y corrección append-only', () => {
    expect(page).toContain('Cierre original');
    expect(page).toContain('Estado corregido');
    expect(page).toContain('Corregir declaración');
    expect(page).toContain('el cierre original no se modifica');
  });

  it('incluye adaptación móvil sin tabla horizontal', () => {
    expect(styles).toContain('.cash-totals');
    expect(styles).toMatch(/@media \(max-width: 48rem\)[\s\S]*\.cash-totals/);
    expect(page).not.toContain('<table');
  });
});
