import { toast } from 'sonner';
import { ApiClientError } from './api-client';

export const notifySuccess = (title: string, description?: string) => {
  toast.success(title, {
    description,
    duration: 4000,
  });
};

export const notifyError = (
  error: unknown,
  fallbackTitle = 'Error en la operación',
  customCode?: string,
) => {
  let message = 'Ocurrió un error inesperado al procesar la solicitud.';
  let code = customCode ?? 'ERR_UNKNOWN';

  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, any>;

    // 1. Si es ApiClientError o tiene el objeto error interno (ApiErrorDto)
    if (err.error && typeof err.error === 'object') {
      message = err.error.message || err.message || message;
      code = customCode ?? err.error.code ?? (err.status ? `HTTP_${err.status}` : code);
    }
    // 2. Si vino con una estructura plana de respuesta o Axios/Fetch estándar
    else if (err.code) {
      code = customCode ?? String(err.code);
      message = err.message || message;
    }
    // 3. Fallback de mensaje estándar de Error
    else if (err.message) {
      message = String(err.message);
    }
  } else if (typeof error === 'string') {
    message = error;
  }

  toast.error(fallbackTitle, {
    description: `${message} (Código: ${code})`,
    duration: 6000,
  });
};
