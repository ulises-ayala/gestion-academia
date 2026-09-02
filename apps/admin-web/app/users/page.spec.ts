import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../components/admin-shell.tsx', import.meta.url), 'utf8');

describe('Users page security', () => {
  it('muestra Usuarios únicamente con el permiso exclusivo de Dirección', () => {
    expect(shell).toContain("label: 'Usuarios', permission: 'users:manage-direction'");
  });

  it('solicita la contraseña actual antes de desactivar una cuenta', () => {
    expect(page).toContain('Tu contraseña actual de Dirección');
    expect(page).toContain('autoComplete="current-password"');
    expect(page).toContain('currentPassword: password');
    expect(page).toContain('Confirmar desactivación');
  });
});
