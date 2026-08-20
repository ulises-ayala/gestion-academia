export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export type AuthUser = Readonly<{
  id: string;
  username: string;
  passwordHash: string;
  role: 'ADMINISTRATOR' | 'RECEPTION' | 'MANAGER';
  status: 'ACTIVE' | 'INACTIVE';
}>;
export type PublicAuthUser = Omit<AuthUser, 'passwordHash'>;

export interface AuthRepository {
  countUsers(): Promise<number>;
  findUserByUsername(username: string): Promise<AuthUser | null>;
  createAdministrator(username: string, passwordHash: string): Promise<AuthUser>;
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findUserBySession(tokenHash: string, now: Date): Promise<AuthUser | null>;
  deleteSession(tokenHash: string): Promise<void>;
}
