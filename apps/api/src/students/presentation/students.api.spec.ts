import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DomainExceptionFilter } from '../../shared/presentation/domain-exception.filter';
import type { StudentPersistenceInput, StudentRepository } from '../application/student.repository';
import { STUDENT_REPOSITORY } from '../application/student.repository';
import { StudentsService } from '../application/students.service';
import type { StudentData } from '../domain/student';
import { StudentsController } from './students.controller';

class ApiTestRepository implements StudentRepository {
  students: StudentData[] = [];
  async create(input: StudentPersistenceInput) { const now = new Date(); const value = { ...input, id: crypto.randomUUID(), joinedAt: now, createdAt: now, updatedAt: now }; this.students.push(value); return value; }
  async findAll(status?: 'ACTIVE' | 'INACTIVE') { return this.students.filter((item) => !status || item.status === status); }
  async findById(id: string) { return this.students.find((item) => item.id === id) ?? null; }
  async findByDni(dni: string) { return this.students.find((item) => item.dni === dni) ?? null; }
  async update(id: string, input: StudentPersistenceInput) { const index = this.students.findIndex((item) => item.id === id); const current = this.students[index]; if (!current) throw new Error('missing'); const value = { ...current, ...input, updatedAt: new Date() }; this.students[index] = value; return value; }
}

describe('Students API', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [StudentsService, { provide: STUDENT_REPOSITORY, useClass: ApiTestRepository }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1/students`;
  });

  afterEach(async () => { await app.close(); });

  it('crea, lista y desactiva un alumno por HTTP', async () => {
    const createdResponse = await fetch(baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dni: '12.345.678', firstName: 'Ana', lastName: 'Pérez' }) });
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json() as StudentData;

    const listResponse = await fetch(`${baseUrl}?status=ACTIVE`);
    expect(await listResponse.json()).toMatchObject([{ id: created.id, dni: '12345678' }]);

    const deleteResponse = await fetch(`${baseUrl}/${created.id}`, { method: 'DELETE' });
    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toMatchObject({ status: 'INACTIVE' });
  });

  it('devuelve errores HTTP consistentes', async () => {
    const response = await fetch(baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dni: 'abc', firstName: '', lastName: 'Pérez' }) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
