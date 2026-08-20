import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthRepository, AuthUser } from './auth.repository';
import { AuthService } from './auth.service';

class MemoryAuthRepository implements AuthRepository {
  users: AuthUser[] = [];
  sessions = new Map<string, { userId: string; expiresAt: Date }>();
  async countUsers() {
    return this.users.length;
  }
  async findUserByUsername(username: string) {
    return this.users.find((item) => item.username === username) ?? null;
  }
  async createAdministrator(username: string, passwordHash: string) {
    const user: AuthUser = {
      id: crypto.randomUUID(),
      username,
      passwordHash,
      role: 'ADMINISTRATOR',
      status: 'ACTIVE',
    };
    this.users.push(user);
    return user;
  }
  async createSession(userId: string, tokenHash: string, expiresAt: Date) {
    this.sessions.set(tokenHash, { userId, expiresAt });
  }
  async findUserBySession(tokenHash: string, now: Date) {
    const session = this.sessions.get(tokenHash);
    return session && session.expiresAt > now
      ? (this.users.find((item) => item.id === session.userId) ?? null)
      : null;
  }
  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }
}

describe('AuthService', () => {
  let repository: MemoryAuthRepository;
  let auth: AuthService;
  beforeEach(() => {
    repository = new MemoryAuthRepository();
    auth = new AuthService(repository);
  });

  it('crea una sola cuenta administrativa inicial e inicia sesión', async () => {
    const result = await auth.bootstrap(' Admin ', 'una-clave-segura');
    expect(result.user).toMatchObject({ username: 'admin', role: 'ADMINISTRATOR' });
    await expect(auth.authenticate(result.token)).resolves.toEqual(result.user);
    await expect(auth.bootstrap('otro', 'otra-clave-segura')).rejects.toMatchObject({
      code: 'AUTH_ALREADY_CONFIGURED',
    });
  });

  it('rechaza credenciales incorrectas e invalida la sesión al salir', async () => {
    const created = await auth.bootstrap('admin', 'una-clave-segura');
    await expect(auth.login('admin', 'clave-incorrecta')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    await auth.logout(created.token);
    await expect(auth.authenticate(created.token)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
