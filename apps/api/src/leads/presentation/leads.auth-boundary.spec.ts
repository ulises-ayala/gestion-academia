import { RequestMethod, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../../auth/application/auth.service';
import { AuthGuard } from '../../auth/presentation/auth.guard';
import { AuthorizationGuard } from '../../auth/presentation/authorization.guard';
import { PERMISSIONS_KEY } from '../../auth/presentation/permissions.decorator';
import { DomainError } from '../../shared/domain/domain-error';
import { DomainExceptionFilter } from '../../shared/presentation/domain-exception.filter';
import { LeadsService } from '../application/leads.service';
import { LeadsController } from './leads.controller';

describe('Leads authorization boundary', () => {
  let app: INestApplication;
  let root: string;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        Reflector,
        {
          provide: AuthService,
          useValue: {
            authenticate: async () => {
              throw new DomainError('UNAUTHORIZED', 'Debes iniciar sesión');
            },
          },
        },
        { provide: LeadsService, useValue: {} },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: AuthorizationGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.listen(0, '127.0.0.1');
    root = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1`;
  });
  afterEach(async () => app.close());
  it('protege listado, duplicados, alta, detalle y modificación', async () => {
    const id = crypto.randomUUID();
    for (const [path, method] of [
      ['/leads', 'GET'],
      ['/leads/duplicates?phone=123', 'GET'],
      ['/leads', 'POST'],
      [`/leads/${id}`, 'GET'],
      [`/leads/${id}`, 'PATCH'],
    ] as const)
      expect((await fetch(`${root}${path}`, { method })).status).toBe(401);
  });
  it('declara leads:manage y no expone DELETE', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, LeadsController)).toEqual(['leads:manage']);
    const prototype = LeadsController.prototype as unknown as Record<string, unknown>;
    const methods = Object.getOwnPropertyNames(LeadsController.prototype)
      .map((name) => {
        const method = prototype[name];
        return typeof method === 'function'
          ? Reflect.getMetadata(METHOD_METADATA, method)
          : undefined;
      })
      .filter((method) => method !== undefined);
    expect(methods).not.toContain(RequestMethod.DELETE);
  });
});
