import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import { hashPassword, validatePassword, verifyPassword } from '../domain/password';
import { AUTH_REPOSITORY, type AuthRepository, type PublicAuthUser } from './auth.repository';

export type AuthResult = Readonly<{ token: string; user: PublicAuthUser; expiresAt: Date }>;
const publicUser = ({
  passwordHash: _passwordHash,
  ...user
}: Awaited<ReturnType<AuthRepository['findUserByUsername']>> & {}) => user;

@Injectable()
export class AuthService {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository) {}

  async setupRequired(): Promise<boolean> {
    return (await this.repository.countUsers()) === 0;
  }

  async bootstrap(usernameValue: unknown, passwordValue: unknown): Promise<AuthResult> {
    if (!(await this.setupRequired()))
      throw new DomainError('AUTH_ALREADY_CONFIGURED', 'La configuración inicial ya fue realizada');
    const username = this.normalizeUsername(usernameValue);
    const password = validatePassword(passwordValue);
    const user = await this.repository.createAdministrator(username, await hashPassword(password));
    return this.startSession(user);
  }

  async login(usernameValue: unknown, passwordValue: unknown): Promise<AuthResult> {
    const username = this.normalizeUsername(usernameValue);
    const password = typeof passwordValue === 'string' ? passwordValue : '';
    const user = await this.repository.findUserByUsername(username);
    if (!user || user.status !== 'ACTIVE' || !(await verifyPassword(password, user.passwordHash))) {
      throw new DomainError('INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos');
    }
    return this.startSession(user);
  }

  async authenticate(token: string | undefined): Promise<PublicAuthUser> {
    if (!token) throw new DomainError('UNAUTHORIZED', 'Debes iniciar sesión');
    const user = await this.repository.findUserBySession(this.tokenHash(token), new Date());
    if (!user || user.status !== 'ACTIVE')
      throw new DomainError('UNAUTHORIZED', 'La sesión no es válida o venció');
    return publicUser(user);
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.repository.deleteSession(this.tokenHash(token));
  }

  private async startSession(
    user: NonNullable<Awaited<ReturnType<AuthRepository['findUserByUsername']>>>,
  ): Promise<AuthResult> {
    const token = randomBytes(32).toString('base64url');
    const hours = Number.parseInt(process.env.AUTH_SESSION_HOURS ?? '12', 10);
    const expiresAt = new Date(
      Date.now() + (Number.isFinite(hours) && hours > 0 ? hours : 12) * 60 * 60 * 1000,
    );
    await this.repository.createSession(user.id, this.tokenHash(token), expiresAt);
    return { token, user: publicUser(user), expiresAt };
  }

  private tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private normalizeUsername(value: unknown): string {
    if (typeof value !== 'string')
      throw new DomainError('VALIDATION_ERROR', 'El usuario es obligatorio', { field: 'username' });
    const username = value.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,100}$/.test(username))
      throw new DomainError(
        'VALIDATION_ERROR',
        'El usuario debe tener entre 3 y 100 caracteres y usar letras, números, punto, guion o guion bajo',
        { field: 'username' },
      );
    return username;
  }
}
