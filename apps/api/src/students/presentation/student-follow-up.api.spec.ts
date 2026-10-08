import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../auth/application/auth.service';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { AuthGuard } from '../../auth/presentation/auth.guard';
import { AuthorizationGuard } from '../../auth/presentation/authorization.guard';
import * as permissions from '../../auth/domain/permissions';
import { DomainError } from '../../shared/domain/domain-error';
import { DomainExceptionFilter } from '../../shared/presentation/domain-exception.filter';
import { EnrollmentsService } from '../../enrollments/application/enrollments.service';
import { EnrollmentsController } from '../../enrollments/presentation/enrollments.controller';
import { PrismaStudentFollowUpReader } from '../infrastructure/prisma-student-follow-up.reader';
import { StudentFollowUpController } from './student-follow-up.controller';
import { StudentsController } from './students.controller';
import { StudentsService } from '../application/students.service';
import { StudentOnboardingService } from '../application/student-onboarding.service';

describe('Student follow-up HTTP and permissions', () => {
  let app: INestApplication;
  let url: string;
  let role: PublicAuthUser['role'] | null = 'RECEPTION';
  const list = vi.fn(async () => ({ items: [], total: 0 }));
  const end = vi.fn(async () => ({ status: 'ENDED' }));
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [StudentFollowUpController, StudentsController, EnrollmentsController],
      providers: [
        { provide: PrismaStudentFollowUpReader, useValue: { list, forStudent: async () => [] } },
        { provide: StudentsService, useValue: {} },
        { provide: StudentOnboardingService, useValue: {} },
        { provide: EnrollmentsService, useValue: { end } },
        {
          provide: AuthService,
          useValue: {
            authenticate: async () => {
              if (!role) throw new DomainError('UNAUTHORIZED', 'Iniciá sesión');
              return {
                id: '00000000-0000-4000-8000-000000000001',
                username: 'test',
                status: 'ACTIVE',
                role,
              };
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
  it.each(['RECEPTION', 'MANAGER', 'ADMINISTRATOR'] as const)(
    'allows %s with existing mapping',
    async (selected) => {
      role = selected;
      expect((await fetch(`${url}/students/follow-up`)).status).toBe(200);
      expect(list).toHaveBeenCalledWith({ q: '', minAbsences: 3, page: 1, pageSize: 25 });
      expect(
        (
          await fetch(`${url}/enrollments/00000000-0000-4000-8000-000000000002/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endDate: '2026-10-01', endReason: 'OTHER', endNote: 'Viaje' }),
          })
        ).status,
      ).toBe(201);
      expect(end).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000002',
        expect.objectContaining({ endReason: 'OTHER' }),
        '00000000-0000-4000-8000-000000000001',
      );
    },
  );
  it('requires authentication for follow-up', async () => {
    role = null;
    expect((await fetch(`${url}/students/follow-up`)).status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });
  it('enforces enrollment permission independently of student read permission', async () => {
    // All current roles have both permissions. Simulate a read-only capability without changing the map.
    const check = vi
      .spyOn(permissions, 'hasPermissions')
      .mockImplementation((_user, required) => required.every((p) => p === 'students:manage'));
    try {
      expect((await fetch(`${url}/students/follow-up`)).status).toBe(200);
      expect(
        (
          await fetch(`${url}/enrollments/00000000-0000-4000-8000-000000000002/end`, {
            method: 'POST',
          })
        ).status,
      ).toBe(403);
      expect(end).not.toHaveBeenCalled();
    } finally {
      check.mockRestore();
    }
  });
  it('denies follow-up when student permission is absent', async () => {
    const check = vi.spyOn(permissions, 'hasPermissions').mockReturnValue(false);
    try {
      expect((await fetch(`${url}/students/follow-up`)).status).toBe(403);
      expect(list).not.toHaveBeenCalled();
    } finally {
      check.mockRestore();
    }
  });
  it.each([
    'minAbsences=0',
    'minAbsences=4.5',
    'minAbsences=abc',
    'page=0',
    'pageSize=101',
    'classId=bad',
    `q=${'a'.repeat(101)}`,
  ])('validates %s', async (query) => {
    expect((await fetch(`${url}/students/follow-up?${query}`)).status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });
  it.each([
    ['1', 1],
    ['6', 6],
  ])('accepts minAbsences=%s', async (value, expected) => {
    expect((await fetch(`${url}/students/follow-up?minAbsences=${value}`)).status).toBe(200);
    expect(list).toHaveBeenCalledWith({ q: '', minAbsences: expected, page: 1, pageSize: 25 });
  });
  it('routes per-student follow-up distinctly from student detail', async () => {
    expect(
      (await fetch(`${url}/students/00000000-0000-4000-8000-000000000002/follow-up`)).status,
    ).toBe(200);
  });
});
