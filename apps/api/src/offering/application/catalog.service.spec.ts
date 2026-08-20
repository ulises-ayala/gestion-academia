import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';

const now = new Date();
describe('CatalogService', () => {
  let repo: CatalogRepository; let service: CatalogService;
  beforeEach(() => {
    repo = {
      listDanceTypes: vi.fn(async () => []), findDanceType: vi.fn(async () => null), findDanceTypeByNormalizedName: vi.fn(async () => null), createDanceType: vi.fn(async (data) => ({ ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now })), updateDanceType: vi.fn(), danceTypeHasActiveClasses: vi.fn(async () => false),
      listBranches: vi.fn(async () => []), findBranch: vi.fn(async () => null), createBranch: vi.fn(async (data) => ({ ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now })), updateBranch: vi.fn(), branchHasActiveRooms: vi.fn(async () => false),
      listRooms: vi.fn(async () => []), findRoom: vi.fn(async () => null), createRoom: vi.fn(async (data) => ({ ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now, branch: { id: data.branchId, name: 'Centro' } })), updateRoom: vi.fn(), roomHasActiveSchedules: vi.fn(async () => false),
    };
    service = new CatalogService(repo);
  });
  it('crea tipo de danza con nombre normalizado', async () => { await expect(service.createDanceType({ name: '  Bachata  ' })).resolves.toMatchObject({ name: 'Bachata', normalizedName: 'bachata' }); });
  it('evita un tipo de danza equivalente', async () => { vi.mocked(repo.findDanceTypeByNormalizedName).mockResolvedValue({ id: crypto.randomUUID(), name: 'Bachata', normalizedName: 'bachata', description: null, status: 'ACTIVE', createdAt: now, updatedAt: now }); await expect(service.createDanceType({ name: 'BACHATA' })).rejects.toMatchObject({ code: 'DANCE_TYPE_ALREADY_EXISTS' }); });
  it('desactiva tipo de danza libre', async () => { const item = { id: crypto.randomUUID(), name: 'Salsa', normalizedName: 'salsa', description: null, status: 'ACTIVE' as const, createdAt: now, updatedAt: now }; vi.mocked(repo.findDanceType).mockResolvedValue(item); vi.mocked(repo.updateDanceType).mockImplementation(async (_id, data) => ({ ...item, ...data })); await expect(service.updateDanceType(item.id, { status: 'INACTIVE' })).resolves.toMatchObject({ status: 'INACTIVE' }); });
  it('crea sucursal y salón asociado', async () => { const branch = await service.createBranch({ name: 'Centro', address: 'Calle 1' }); vi.mocked(repo.findBranch).mockResolvedValue(branch); await expect(service.createRoom({ name: 'Salón 1', capacity: 20, branchId: branch.id })).resolves.toMatchObject({ branchId: branch.id, capacity: 20 }); });
  it('rechaza capacidad inválida', async () => { await expect(service.createRoom({ name: 'Salón', capacity: 0, branchId: crypto.randomUUID() })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' }); });
  it('delega el filtro de salones por sucursal', async () => { const branchId = crypto.randomUUID(); await service.listRooms('ACTIVE', branchId); expect(repo.listRooms).toHaveBeenCalledWith('ACTIVE', branchId); });
});
