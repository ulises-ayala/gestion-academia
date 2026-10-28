import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../auth/application/auth.service';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { AuthGuard } from '../../auth/presentation/auth.guard';
import { AuthorizationGuard } from '../../auth/presentation/authorization.guard';
import { DomainError } from '../../shared/domain/domain-error';
import { DomainExceptionFilter } from '../../shared/presentation/domain-exception.filter';
import { ClassesService } from '../application/classes.service';
import { ClassesController } from './classes.controller';

const actorId = '00000000-0000-4000-8000-000000000001';
const classId = '00000000-0000-4000-8000-000000000002';

describe('Classes HTTP permissions', () => {
  let app: INestApplication;
  let url: string;
  let role: PublicAuthUser['role'] = 'RECEPTION';
  const update = vi.fn(async () => ({ id: classId }));
  const create = vi.fn(async () => ({ id: classId }));
  const deactivate = vi.fn(async () => ({ id: classId }));
  const send = (path: string, method: string, body?: unknown) =>
    fetch(`${url}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ClassesController],
      providers: [
        { provide: ClassesService, useValue: { update, create, deactivate } },
        {
          provide: AuthService,
          useValue: {
            authenticate: async () => {
              if (!role) throw new DomainError('UNAUTHORIZED', 'Iniciá sesión');
              return { id: actorId, username: 'test', status: 'ACTIVE', role };
            },
          },
        },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: AuthorizationGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    role = 'RECEPTION';
    vi.clearAllMocks();
  });
  afterAll(async () => app.close());

  it.each(['RECEPTION', 'MANAGER', 'ADMINISTRATOR'] as const)('%s edita una clase', async (r) => {
    role = r;
    expect((await send(`/classes/${classId}`, 'PATCH', { capacity: 20 })).status).toBe(200);
    expect(update).toHaveBeenCalledWith(classId, { capacity: 20 }, actorId);
  });
  it('Admisión no crea, desactiva ni cambia el estado desde la edición', async () => {
    expect((await send(`/classes/${classId}`, 'PATCH', { status: 'INACTIVE' })).status).toBe(403);
    expect((await send('/classes', 'POST', { name: 'Salsa' })).status).toBe(403);
    expect((await send(`/classes/${classId}`, 'DELETE')).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(deactivate).not.toHaveBeenCalled();
  });
  it('Administración conserva el cambio de estado desde la edición', async () => {
    role = 'MANAGER';
    expect((await send(`/classes/${classId}`, 'PATCH', { status: 'ACTIVE' })).status).toBe(200);
  });
});
