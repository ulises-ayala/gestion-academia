import { Prisma } from '@academy/database';
import { describe, expect, it, vi } from 'vitest';
import {
  SERIALIZABLE_TRANSACTION_ATTEMPTS,
  isSerializationConflict,
  withSerializableRetry,
} from './serializable-retry';

const conflict = (code = 'P2034', meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('conflict', {
    code,
    clientVersion: 'test',
    ...(meta ? { meta } : {}),
  });
const exhausted = () => new Error('exhausted');

describe('withSerializableRetry', () => {
  it('recognises serialization failures and deadlocks only', () => {
    expect(isSerializationConflict(conflict())).toBe(true);
    expect(isSerializationConflict(conflict('P2010', { code: '40P01' }))).toBe(true);
    expect(isSerializationConflict(conflict('P2002'))).toBe(false);
    expect(isSerializationConflict(new Error('other'))).toBe(false);
  });

  it('retries conflicts until an attempt succeeds', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(conflict())
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce('ok');
    await expect(withSerializableRetry(run, exhausted)).resolves.toBe('ok');
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('throws the domain error after exhausting every attempt', async () => {
    const run = vi.fn().mockRejectedValue(conflict());
    await expect(withSerializableRetry(run, exhausted)).rejects.toThrow('exhausted');
    expect(run).toHaveBeenCalledTimes(SERIALIZABLE_TRANSACTION_ATTEMPTS);
  });

  it('does not retry other errors', async () => {
    const failure = conflict('P2002');
    const run = vi.fn().mockRejectedValue(failure);
    await expect(withSerializableRetry(run, exhausted)).rejects.toBe(failure);
    expect(run).toHaveBeenCalledOnce();
  });
});
