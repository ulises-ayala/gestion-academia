import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('Condiciones económicas en Ficha 360', () => {
  it('explica la sección y usa un botón principal inequívoco', () => {
    expect(page).toContain('Condiciones económicas');
    expect(page).toContain('Becas y descuentos aplicados a esta actividad.');
    expect(page).toContain('+ Agregar beca o descuento');
    expect(page).toContain('No hay becas ni descuentos vigentes para esta actividad.');
    expect(page).not.toContain('<strong>Ajustes de facturación</strong>');
  });

  it('presenta las tres opciones y deja explícito que las becas son siempre 100%', () => {
    expect(page).toContain('Beca de Dirección — 100%');
    expect(page).toContain('Beca del profesor — 100%');
    expect(page).toContain('<strong>Descuento del profesor</strong>');
    expect(page).toContain('Cobertura');
    expect(page).toContain('Las becas son siempre del 100%');
    expect(page).toContain('Para una reducción parcial, utilizá Descuento del');
    expect(page).toContain('profesor.');
    expect(page).toContain("type !== 'TEACHER_DISCOUNT'");
  });

  it('ofrece porcentaje validado y monto fijo solamente para descuento del profesor', () => {
    expect(page).toContain('Tipo de descuento');
    expect(page).toContain('Porcentaje');
    expect(page).toContain('Monto fijo');
    expect(page).toContain("max={calculation === 'PERCENTAGE' ? '100' : undefined}");
    expect(page).toContain('min="0.01"');
    expect(page).toContain('50% sobre una cuota de $40.000 reduce $20.000');
    expect(page).toContain('un monto fijo de $10.000');
  });

  it('muestra condiciones existentes con texto humano, vigencia y acciones legibles', () => {
    expect(page).toContain("month: 'long'");
    expect(page).toContain("year: 'numeric'");
    expect(page).toContain("' de cobertura'");
    expect(page).toContain('Vigente desde');
    expect(page).toContain('Profesor');
    expect(page).toContain('Vigente');
    expect(page).toContain('Finalizada');
    expect(page).toContain('Renovar');
    expect(page).toContain('Finalizar');
  });

  it('mantiene permisos existentes y no habilita acciones para Reception', () => {
    expect(page).toContain('{canManage && (');
    expect(page).toContain('{isAdministrator && (');
    expect(page).toContain("canManage={can('charges:manage')}");
    expect(page).toContain("isAdministrator={user.role === 'ADMINISTRATOR'}");
    expect(page).toContain("item.type !== 'DIRECTION_SCHOLARSHIP' || isAdministrator");
  });

  it('usa variables semánticas y reglas responsive para light y dark mode', () => {
    expect(css).toContain('--brand-on-fill: #fff');
    expect(css).toContain(":root[data-theme='dark']");
    expect(css).toContain('.billing-add-button');
    expect(css).toContain('color: var(--brand-on-fill)');
    expect(css).toContain('.billing-condition-actions button');
    expect(css).toContain('@media (max-width: 48rem)');
    expect(css).toContain('width: 100%');
  });
});
