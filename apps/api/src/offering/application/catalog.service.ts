import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateBranchDto,
  CreateDanceTypeDto,
  CreateRoomDto,
  UpdateBranchDto,
  UpdateDanceTypeDto,
  UpdateRoomDto,
} from '@academy/contracts';
import { DomainError } from '../../shared/domain/domain-error';
import { validateBranch, validateDanceType, validateRoom, type Status } from '../domain/catalog';
import { CATALOG_REPOSITORY, type CatalogRepository } from './catalog.repository';
@Injectable()
export class CatalogService {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository) {}
  listDanceTypes(status?: Status) {
    return this.repo.listDanceTypes(status);
  }
  async getDanceType(id: string) {
    const item = await this.repo.findDanceType(id);
    if (!item) throw new DomainError('DANCE_TYPE_NOT_FOUND', 'Tipo de danza no encontrado');
    return item;
  }
  async createDanceType(input: CreateDanceTypeDto) {
    const data = validateDanceType(input);
    if (await this.repo.findDanceTypeByNormalizedName(data.normalizedName))
      throw new DomainError(
        'DANCE_TYPE_ALREADY_EXISTS',
        'Ya existe un tipo de danza con ese nombre',
        { field: 'name' },
      );
    return this.repo.createDanceType(data);
  }
  async updateDanceType(id: string, patch: UpdateDanceTypeDto, actorId?: string) {
    const current = await this.getDanceType(id);
    if (
      patch.status === 'INACTIVE' &&
      current.status === 'ACTIVE' &&
      (await this.repo.danceTypeHasActiveClasses(id))
    )
      throw new DomainError(
        'DANCE_TYPE_IN_USE',
        'No se puede desactivar un tipo de danza utilizado por clases activas',
      );
    const data = validateDanceType({
      name: patch.name ?? current.name,
      description: patch.description === undefined ? current.description : patch.description,
      status: patch.status ?? current.status,
    });
    const duplicate = await this.repo.findDanceTypeByNormalizedName(data.normalizedName);
    if (duplicate && duplicate.id !== id)
      throw new DomainError(
        'DANCE_TYPE_ALREADY_EXISTS',
        'Ya existe un tipo de danza con ese nombre',
        { field: 'name' },
      );
    return this.repo.updateDanceType(id, data, actorId);
  }

  listBranches(status?: Status) {
    return this.repo.listBranches(status);
  }
  async getBranch(id: string) {
    const item = await this.repo.findBranch(id);
    if (!item) throw new DomainError('BRANCH_NOT_FOUND', 'Sucursal no encontrada');
    return item;
  }
  async createBranch(input: CreateBranchDto) {
    return this.repo.createBranch(validateBranch(input));
  }
  async updateBranch(id: string, patch: UpdateBranchDto, actorId?: string) {
    const current = await this.getBranch(id);
    if (
      patch.status === 'INACTIVE' &&
      current.status === 'ACTIVE' &&
      (await this.repo.branchHasActiveRooms(id))
    )
      throw new DomainError(
        'BRANCH_IN_USE',
        'No se puede desactivar una sucursal con salones activos',
      );
    return this.repo.updateBranch(
      id,
      validateBranch({
        name: patch.name ?? current.name,
        address: patch.address ?? current.address,
        status: patch.status ?? current.status,
      }),
      actorId,
    );
  }

  listRooms(status?: Status, branchId?: string) {
    return this.repo.listRooms(status, branchId);
  }
  async getRoom(id: string) {
    const item = await this.repo.findRoom(id);
    if (!item) throw new DomainError('ROOM_NOT_FOUND', 'Salón no encontrado');
    return item;
  }
  async createRoom(input: CreateRoomDto) {
    const data = validateRoom(input);
    const branch = await this.getBranch(data.branchId);
    if (branch.status !== 'ACTIVE')
      throw new DomainError(
        'BRANCH_INACTIVE',
        'No se puede crear un salón en una sucursal inactiva',
        { field: 'branchId' },
      );
    return this.repo.createRoom(data);
  }
  async updateRoom(id: string, patch: UpdateRoomDto, actorId?: string) {
    const current = await this.getRoom(id);
    if (
      patch.status === 'INACTIVE' &&
      current.status === 'ACTIVE' &&
      (await this.repo.roomHasActiveSchedules(id))
    )
      throw new DomainError(
        'ROOM_IN_USE',
        'No se puede desactivar un salón utilizado por clases activas',
      );
    const branchId = patch.branchId ?? current.branchId;
    const data = validateRoom({
      name: patch.name ?? current.name,
      capacity: patch.capacity ?? current.capacity,
      branchId,
      status: patch.status ?? current.status,
    });
    const branch = await this.getBranch(branchId);
    if (branch.status !== 'ACTIVE' && data.status === 'ACTIVE')
      throw new DomainError('BRANCH_INACTIVE', 'La sucursal seleccionada está inactiva', {
        field: 'branchId',
      });
    return this.repo.updateRoom(id, data, actorId);
  }
}
