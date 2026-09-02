import type { ApiErrorDto } from '@academy/contracts';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly error: ApiErrorDto,
  ) {
    super(error.message);
    this.name = 'ApiClientError';
  }

  get field(): string | undefined {
    return typeof this.error.details?.field === 'string' ? this.error.details.field : undefined;
  }
}

export const apiErrorMessage = (status: number, error: ApiErrorDto) => {
  if (status === 403) return 'No tenés permisos para realizar esta acción.';
  if (status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión.';
  if (status >= 500) return 'Ocurrió un problema en el servidor. Intentá nuevamente.';
  return error.message;
};

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    cache: init?.cache ?? 'no-store',
    credentials: 'include',
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let error: ApiErrorDto = { code: 'HTTP_ERROR', message: 'No se pudo completar la operación' };
    try {
      error = (await response.json()) as ApiErrorDto;
    } catch {
      /* respuesta sin JSON */
    }
    if (response.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('academy:unauthorized'));
    throw new ApiClientError(response.status, {
      ...error,
      message: apiErrorMessage(response.status, error),
    });
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
