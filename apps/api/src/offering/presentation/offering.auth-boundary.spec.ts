import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../../auth/application/auth.service';
import { AuthGuard } from '../../auth/presentation/auth.guard';
import { DomainError } from '../../shared/domain/domain-error';
import { DomainExceptionFilter } from '../../shared/presentation/domain-exception.filter';
import { TeachersService } from '../../teachers/application/teachers.service';
import { TeachersController } from '../../teachers/presentation/teachers.controller';
import { CatalogService } from '../application/catalog.service';
import { ClassesService } from '../application/classes.service';
import { BranchesController } from './branches.controller';
import { ClassesController } from './classes.controller';
import { DanceTypesController } from './dance-types.controller';
import { RoomsController } from './rooms.controller';
describe('Offering authentication boundary', () => {
  let app: INestApplication;
  let root: string;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        TeachersController,
        DanceTypesController,
        BranchesController,
        RoomsController,
        ClassesController,
      ],
      providers: [
        {
          provide: AuthService,
          useValue: {
            authenticate: async () => {
              throw new DomainError('UNAUTHORIZED', 'Debes iniciar sesión');
            },
          },
        },
        { provide: TeachersService, useValue: {} },
        { provide: CatalogService, useValue: {} },
        { provide: ClassesService, useValue: {} },
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
  it('protege todos los nuevos recursos administrativos', async () => {
    for (const path of ['/teachers', '/dance-types', '/branches', '/rooms', '/classes'])
      expect((await fetch(`${root}${path}`)).status).toBe(401);
  });
});
