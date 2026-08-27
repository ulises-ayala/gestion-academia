import type { INestApplication } from '@nestjs/common';
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
import { AttendancesService } from '../application/attendances.service';
import { AttendancesController } from './attendances.controller';

describe('Attendances authorization boundary', () => {
  let app: INestApplication;
  let root: string;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AttendancesController],
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
        { provide: AttendancesService, useValue: {} },
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

  it('protege listado, roster, alta, detalle y modificación', async () => {
    const attendanceId = crypto.randomUUID();
    const classId = crypto.randomUUID();
    const requests: [string, string][] = [
      ['/attendances', 'GET'],
      ['/attendances/day?date=2026-08-15', 'GET'],
      [`/attendances/roster?classId=${classId}&date=2026-08-15`, 'GET'],
      ['/attendances/roster', 'PUT'],
      ['/attendances/quick-search?q=Ana&date=2026-08-15', 'GET'],
      ['/attendances', 'POST'],
      [`/attendances/${attendanceId}`, 'GET'],
      [`/attendances/${attendanceId}`, 'PATCH'],
    ];
    for (const [path, method] of requests)
      expect((await fetch(`${root}${path}`, { method })).status).toBe(401);
  });

  it('declara attendance:manage para todos los endpoints del controller', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, AttendancesController)).toEqual([
      'attendance:manage',
    ]);
  });
});
