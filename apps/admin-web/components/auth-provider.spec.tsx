import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../lib/api-client';
import { PasswordField, authenticate } from './auth-provider';

vi.mock('../lib/api-client', () => ({
  apiRequest: vi.fn(),
  ApiClientError: class extends Error {},
}));

const password = 'CarmesiSegura2026!';
const fieldParts = (visible: boolean, onToggle = vi.fn()) => {
  const field = PasswordField({
    password,
    visible,
    setupRequired: false,
    onChange: vi.fn(),
    onToggle,
  });
  const [input, button] = field.props.children;
  return { input, button };
};

describe('password reveal', () => {
  it('empieza oculta, alterna sin perder el valor y el control no envía el formulario', () => {
    const onToggle = vi.fn();
    const hidden = fieldParts(false, onToggle);
    expect(hidden.input.props).toMatchObject({
      type: 'password',
      value: password,
      autoComplete: 'current-password',
    });
    expect(hidden.button.props).toMatchObject({
      type: 'button',
      'aria-label': 'Mostrar contraseña',
      'aria-pressed': false,
      children: 'Mostrar',
    });
    hidden.button.props.onClick();
    expect(onToggle).toHaveBeenCalledOnce();

    const visible = fieldParts(true);
    expect(visible.input.props).toMatchObject({ type: 'text', value: password });
    expect(visible.button.props).toMatchObject({
      'aria-label': 'Ocultar contraseña',
      'aria-pressed': true,
      children: 'Ocultar',
    });
    expect(fieldParts(false).input.props.type).toBe('password');
  });

  it('preserva new-password durante bootstrap', () => {
    const field = PasswordField({
      password,
      visible: false,
      setupRequired: true,
      onChange: vi.fn(),
      onToggle: vi.fn(),
    });
    expect(field.props.children[0].props.autoComplete).toBe('new-password');
  });

  it('envía las credenciales intactas al login', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ user: {} } as never);
    const credentials = { username: 'direccion', password };
    await authenticate(credentials, false);
    expect(apiRequest).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  });
});
