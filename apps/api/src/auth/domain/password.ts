import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { DomainError } from '../../shared/domain/domain-error';

const keyLength = 64;
const cost = 16384;
const blockSize = 8;
const parallelization = 1;

const scrypt = (
  password: string,
  salt: Buffer,
  options = { cost, blockSize, parallelization },
): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    nodeScrypt(password, salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key as Buffer),
    ),
  );

export const validatePassword = (value: unknown): string => {
  if (typeof value !== 'string' || value.length < 12 || value.length > 200) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'La contraseña debe tener entre 12 y 200 caracteres',
      { field: 'password' },
    );
  }
  return value;
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const hash = await scrypt(validatePassword(password), salt);
  return `scrypt$${cost}$${blockSize}$${parallelization}$${salt.toString('base64')}$${hash.toString('base64')}`;
};

export const verifyPassword = async (password: string, encoded: string): Promise<boolean> => {
  const [algorithm, n, r, p, saltValue, hashValue] = encoded.split('$');
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, 'base64');
  if (expected.length !== keyLength) return false;
  const actual = await scrypt(password, Buffer.from(saltValue, 'base64'), {
    cost: Number(n),
    blockSize: Number(r),
    parallelization: Number(p),
  });
  return timingSafeEqual(actual, expected);
};
