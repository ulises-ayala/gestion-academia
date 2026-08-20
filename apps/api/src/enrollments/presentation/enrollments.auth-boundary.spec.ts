import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../../auth/application/auth.service';
import { AuthGuard } from '../../auth/presentation/auth.guard';
import { DomainError } from '../../shared/domain/domain-error';
import { DomainExceptionFilter } from '../../shared/presentation/domain-exception.filter';
import { EnrollmentsService } from '../application/enrollments.service';
import { EnrollmentsController } from './enrollments.controller';
describe('Enrollment authentication boundary', () => {
  let app: INestApplication;
  let root: string;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [EnrollmentsController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            authenticate: async () => {
              throw new DomainError('UNAUTHORIZED', 'Debes iniciar sesión');
            },
          },
        },
        { provide: EnrollmentsService, useValue: {} },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.listen(0, '127.0.0.1');
    root = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1`;
  });
  afterEach(async () => app.close());
  it('protege listado, alta, detalle y finalización', async () => {
    const requests: [string, string][] = [
      ['/enrollments', 'GET'],
      ['/enrollments', 'POST'],
      [`/enrollments/${crypto.randomUUID()}`, 'GET'],
      [`/enrollments/${crypto.randomUUID()}/end`, 'POST'],
    ];
    for (const [path, method] of requests)
      expect((await fetch(`${root}${path}`, { method })).status).toBe(401);
  });
});
