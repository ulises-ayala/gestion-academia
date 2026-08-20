import { beforeEach, describe, expect, it } from 'vitest';
import type { TeacherData } from '../domain/teacher';
import type { TeacherQuery, TeacherRepository, TeacherWrite } from './teacher.repository';
import { TeachersService } from './teachers.service';
class MemoryTeachers implements TeacherRepository {
  items: TeacherData[] = []; activeClassTeachers = new Set<string>();
  async create(data: TeacherWrite) { const now = new Date(); const item = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now }; this.items.push(item); return item; }
  async update(id: string, data: TeacherWrite) { const index = this.items.findIndex((item) => item.id === id); const current = this.items[index]!; const item = { ...current, ...data, updatedAt: new Date() }; this.items[index] = item; return item; }
  async findById(id: string) { return this.items.find((item) => item.id === id) ?? null; }
  async findByDni(dni: string) { return this.items.find((item) => item.dni === dni) ?? null; }
  async hasActiveClasses(id: string) { return this.activeClassTeachers.has(id); }
  async findPage(query: TeacherQuery) { const q = query.q?.toLowerCase(); const digits = q?.replace(/\D/g, ''); const filtered = this.items.filter((item) => (!query.status || item.status === query.status) && (!q || `${item.firstName} ${item.lastName}`.toLowerCase().includes(q) || item.dni.includes(digits ?? q) || item.phone?.includes(q))); return { items: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: filtered.length, page: query.page, pageSize: query.pageSize }; }
}
describe('TeachersService', () => {
  let repo: MemoryTeachers; let service: TeachersService;
  beforeEach(() => { repo = new MemoryTeachers(); service = new TeachersService(repo); });
  it('crea, normaliza DNI, edita y busca', async () => { const teacher = await service.create({ dni: '12.345.678', firstName: ' Ana ', lastName: 'Pérez', phone: '5555' }); expect(teacher.dni).toBe('12345678'); await expect(service.update(teacher.id, { firstName: 'María' })).resolves.toMatchObject({ firstName: 'María' }); await expect(service.list({ q: 'maría', page: 1, pageSize: 25 })).resolves.toMatchObject({ total: 1 }); });
  it('rechaza DNI duplicado', async () => { await service.create({ dni: '12.345.678', firstName: 'Ana', lastName: 'Pérez' }); await expect(service.create({ dni: '12345678', firstName: 'Juan', lastName: 'Gómez' })).rejects.toMatchObject({ code: 'DNI_ALREADY_EXISTS' }); });
  it('desactiva y reactiva', async () => { const item = await service.create({ dni: '12345678', firstName: 'Ana', lastName: 'Pérez' }); await expect(service.deactivate(item.id)).resolves.toMatchObject({ status: 'INACTIVE' }); await expect(service.reactivate(item.id)).resolves.toMatchObject({ status: 'ACTIVE' }); });
  it('impide desactivar si dicta una clase activa', async () => { const item = await service.create({ dni: '12345678', firstName: 'Ana', lastName: 'Pérez' }); repo.activeClassTeachers.add(item.id); await expect(service.deactivate(item.id)).rejects.toMatchObject({ code: 'TEACHER_IN_USE' }); });
});
