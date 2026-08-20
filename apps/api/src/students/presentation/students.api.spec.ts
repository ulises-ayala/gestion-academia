import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DomainExceptionFilter } from '../../shared/presentation/domain-exception.filter';
import { STUDENT_REPOSITORY } from '../application/student.repository';
import { StudentsService } from '../application/students.service';
import { MemoryStudentRepository } from '../testing/memory-student.repository';
import { StudentsController } from './students.controller';

describe('Students HTTP contract', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ controllers: [StudentsController], providers: [StudentsService, { provide: STUDENT_REPOSITORY, useClass: MemoryStudentRepository }] }).compile();
    app = module.createNestApplication(); app.setGlobalPrefix('api/v1'); app.useGlobalFilters(new DomainExceptionFilter());
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1/students`;
  });
  afterEach(async () => { await app.close(); });

  it('crea, pagina, obtiene detalle, desactiva y reactiva', async () => {
    const create = await fetch(baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dni: '12.345.678', firstName: 'Ana', lastName: 'Pérez' }) });
    expect(create.status).toBe(201);
    const student = await create.json() as { id: string };
    const list = await (await fetch(`${baseUrl}?q=ana&status=ACTIVE&page=1&pageSize=25`)).json();
    expect(list).toMatchObject({ total: 1, page: 1, pageSize: 25, items: [{ id: student.id }] });
    expect((await fetch(`${baseUrl}/${student.id}`)).status).toBe(200);
    expect(await (await fetch(`${baseUrl}/${student.id}`, { method: 'DELETE' })).json()).toMatchObject({ status: 'INACTIVE' });
    expect(await (await fetch(`${baseUrl}/${student.id}/reactivate`, { method: 'POST' })).json()).toMatchObject({ status: 'ACTIVE' });
  });

  it('valida page, pageSize y estado', async () => {
    for (const query of ['page=0', 'pageSize=101', 'status=UNKNOWN']) {
      const response = await fetch(`${baseUrl}?${query}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    }
  });
});
