import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AUTH_REPOSITORY, type AuthRepository, type AuthUser } from '../../auth/application/auth.repository';
import { AuthService } from '../../auth/application/auth.service';
import { AuthController } from '../../auth/presentation/auth.controller';
import { AuthGuard } from '../../auth/presentation/auth.guard';
import { DomainExceptionFilter } from '../../shared/presentation/domain-exception.filter';
import { STUDENT_REPOSITORY } from '../application/student.repository';
import { StudentsService } from '../application/students.service';
import { MemoryStudentRepository } from '../testing/memory-student.repository';
import { StudentsController } from './students.controller';

class BoundaryAuthRepository implements AuthRepository {
  users: AuthUser[] = [];
  sessions = new Map<string, { userId: string; expiresAt: Date }>();
  async countUsers() { return this.users.length; }
  async findUserByUsername(username: string) { return this.users.find((user) => user.username === username) ?? null; }
  async createAdministrator(username: string, passwordHash: string) { const user: AuthUser = { id: crypto.randomUUID(), username, passwordHash, role: 'ADMINISTRATOR', status: 'ACTIVE' }; this.users.push(user); return user; }
  async createSession(userId: string, tokenHash: string, expiresAt: Date) { this.sessions.set(tokenHash, { userId, expiresAt }); }
  async findUserBySession(tokenHash: string, now: Date) { const session = this.sessions.get(tokenHash); return session && session.expiresAt > now ? this.users.find((user) => user.id === session.userId) ?? null : null; }
  async deleteSession(tokenHash: string) { this.sessions.delete(tokenHash); }
}

describe('Students authentication boundary', () => {
  let app: INestApplication;
  let rootUrl: string;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController, StudentsController],
      providers: [
        AuthService,
        StudentsService,
        { provide: AUTH_REPOSITORY, useClass: BoundaryAuthRepository },
        { provide: STUDENT_REPOSITORY, useClass: MemoryStudentRepository },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();
    app = module.createNestApplication(); app.setGlobalPrefix('api/v1'); app.useGlobalFilters(new DomainExceptionFilter());
    await app.listen(0, '127.0.0.1');
    rootUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1`;
  });
  afterEach(async () => { await app.close(); });

  it('rechaza GET y POST sin sesión', async () => {
    expect((await fetch(`${rootUrl}/students`)).status).toBe(401);
    expect((await fetch(`${rootUrl}/students`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(401);
  });

  it('permite acceder a un usuario administrativo autenticado', async () => {
    const bootstrap = await fetch(`${rootUrl}/auth/bootstrap`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'una-clave-segura' }) });
    expect(bootstrap.status).toBe(201);
    const cookie = bootstrap.headers.get('set-cookie')?.split(';')[0];
    expect(cookie).toContain('academy_session=');
    const response = await fetch(`${rootUrl}/students`, { headers: { Cookie: cookie ?? '' } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ total: 0, items: [] });
  });
});
