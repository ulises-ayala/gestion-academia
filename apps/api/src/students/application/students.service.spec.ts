import { beforeEach, describe, expect, it } from 'vitest';
import { DomainError } from '../../shared/domain/domain-error';
import { MemoryStudentRepository } from '../testing/memory-student.repository';
import { StudentsService } from './students.service';

describe('StudentsService', () => {
  let repository: MemoryStudentRepository;
  let service: StudentsService;

  beforeEach(() => { repository = new MemoryStudentRepository(); service = new StudentsService(repository); });

  it('crea, normaliza el DNI y obtiene el detalle', async () => {
    const created = await service.create({ dni: '12.345.678', firstName: 'Ana', lastName: 'Pérez' });
    expect(created.dni).toBe('12345678');
    await expect(service.get(created.id)).resolves.toEqual(created);
  });

  it('impide DNI duplicado aun con distinto formato', async () => {
    await service.create({ dni: '12.345.678', firstName: 'Ana', lastName: 'Pérez' });
    await expect(service.create({ dni: '12345678', firstName: 'Juan', lastName: 'Gómez' })).rejects.toMatchObject({ code: 'DNI_ALREADY_EXISTS' } satisfies Partial<DomainError>);
  });

  it('busca por nombre, apellido, nombre completo, DNI y teléfono', async () => {
    await service.create({ dni: '12345678', firstName: 'Ana María', lastName: 'Pérez', phone: '11 5555-1234' });
    for (const q of ['ana', 'pér', 'ana pérez', '12.345', '5555']) {
      await expect(service.list({ q, page: 1, pageSize: 25 })).resolves.toMatchObject({ total: 1 });
    }
  });

  it('filtra activos e inactivos', async () => {
    const inactive = await service.create({ dni: '12345678', firstName: 'Ana', lastName: 'Pérez' });
    await service.create({ dni: '23456789', firstName: 'Juan', lastName: 'Gómez' });
    await service.deactivate(inactive.id);
    await expect(service.list({ status: 'ACTIVE', page: 1, pageSize: 25 })).resolves.toMatchObject({ total: 1, items: [{ firstName: 'Juan' }] });
    await expect(service.list({ status: 'INACTIVE', page: 1, pageSize: 25 })).resolves.toMatchObject({ total: 1, items: [{ firstName: 'Ana' }] });
  });

  it('pagina sin cargar todos los resultados', async () => {
    for (let index = 0; index < 5; index += 1) await service.create({ dni: `1234567${index}`, firstName: `Alumno ${index}`, lastName: 'Prueba' });
    await expect(service.list({ page: 2, pageSize: 2 })).resolves.toMatchObject({ total: 5, page: 2, pageSize: 2, items: [{ firstName: 'Alumno 2' }, { firstName: 'Alumno 3' }] });
  });

  it('informa alumno inexistente', async () => {
    await expect(service.get(crypto.randomUUID())).rejects.toMatchObject({ code: 'STUDENT_NOT_FOUND' });
  });

  it('desactiva y reactiva sin borrar', async () => {
    const created = await service.create({ dni: '12345678', firstName: 'Ana', lastName: 'Pérez' });
    await expect(service.deactivate(created.id)).resolves.toMatchObject({ status: 'INACTIVE' });
    await expect(service.reactivate(created.id)).resolves.toMatchObject({ status: 'ACTIVE' });
    await expect(service.get(created.id)).resolves.toMatchObject({ id: created.id });
  });
});
