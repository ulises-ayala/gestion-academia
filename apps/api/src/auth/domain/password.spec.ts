import { describe, expect, it } from 'vitest';
import { hashPassword, validatePassword, verifyPassword } from './password';

describe('password security', () => {
  it('genera hashes con sal y verifica la contraseña correcta', async () => {
    const first = await hashPassword('una-clave-segura');
    const second = await hashPassword('una-clave-segura');
    expect(first).not.toBe(second);
    await expect(verifyPassword('una-clave-segura', first)).resolves.toBe(true);
    await expect(verifyPassword('clave-incorrecta', first)).resolves.toBe(false);
  });

  it('exige al menos doce caracteres', () => {
    expect(() => validatePassword('muy-corta')).toThrow('entre 12 y 200');
  });
});
