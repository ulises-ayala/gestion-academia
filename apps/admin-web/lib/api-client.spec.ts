import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, apiErrorMessage } from './api-client';

afterEach(() => vi.unstubAllGlobals());

describe('API client feedback', () => {
  it('traduce 403 y errores de servidor a mensajes operativos', () => {
    expect(apiErrorMessage(403, { code: 'FORBIDDEN', message: 'technical' })).toBe(
      'No tenés permisos para realizar esta acción.',
    );
    expect(apiErrorMessage(500, { code: 'INTERNAL', message: 'stack trace' })).toBe(
      'Ocurrió un problema en el servidor. Intentá nuevamente.',
    );
  });

  it('evita cache para lecturas autenticadas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest('/students')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/students'),
      expect.objectContaining({ cache: 'no-store', credentials: 'include' }),
    );
  });

  it('expone el mensaje humano en ApiClientError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'FORBIDDEN', message: 'Acceso denegado interno' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    await expect(apiRequest('/audit')).rejects.toMatchObject({
      message: 'No tenés permisos para realizar esta acción.',
    });
  });
});
