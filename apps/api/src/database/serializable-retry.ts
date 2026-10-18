import { Prisma } from '@academy/database';

/**
 * Política común para transacciones `Serializable`: ante un conflicto de serialización o un
 * deadlock se reintenta con espera exponencial y jitter (25, 50, 100 y 200 ms aprox.), para que
 * dos operaciones concurrentes no vuelvan a chocar en cada intento cuando la base tiene latencia.
 */
export const SERIALIZABLE_TRANSACTION_ATTEMPTS = 5;

export const isSerializationConflict = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === 'P2034' ||
    (error.code === 'P2010' && /40001|40P01|serializ|deadlock/i.test(JSON.stringify(error.meta))));

export const waitBeforeSerializableRetry = (attempt: number) =>
  new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt + Math.random() * 25));

/**
 * Ejecuta `run` y lo reintenta sólo ante conflictos de serialización. Al agotar los intentos
 * lanza el error de dominio que devuelve `onExhausted`; cualquier otro error se propaga tal cual.
 */
export async function withSerializableRetry<T>(
  run: () => Promise<T>,
  onExhausted: () => Error,
  attempts = SERIALIZABLE_TRANSACTION_ATTEMPTS,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!isSerializationConflict(error)) throw error;
      if (attempt >= attempts - 1) throw onExhausted();
      await waitBeforeSerializableRetry(attempt);
    }
  }
}
