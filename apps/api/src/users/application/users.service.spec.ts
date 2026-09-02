import type { AdminRoleDto, AdminUserDto, RecordStatusDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { hashPassword } from '../../auth/domain/password';
import type { UserRepository, UserWithPassword } from './user.repository';
import { UsersService } from './users.service';

class MemoryUsers implements UserRepository {
  items: UserWithPassword[] = [];
  async list() {
    return this.items.map(({ passwordHash: _passwordHash, ...user }) => user);
  }
  async findById(id: string) {
    return this.items.find((user) => user.id === id) ?? null;
  }
  async findByUsername(username: string) {
    return this.items.find((user) => user.username === username) ?? null;
  }
  async countActiveDirectionUsers() {
    return this.items.filter((user) => user.role === 'ADMINISTRATOR' && user.status === 'ACTIVE')
      .length;
  }
  async create(data: { username: string; passwordHash: string; role: AdminRoleDto }) {
    const item: UserWithPassword = {
      ...data,
      id: crypto.randomUUID(),
      status: 'ACTIVE',
    };
    this.items.push(item);
    const { passwordHash: _passwordHash, ...user } = item;
    return user;
  }
  async update(
    id: string,
    data: {
      username: string;
      passwordHash?: string;
      role: AdminRoleDto;
      status: RecordStatusDto;
    },
  ): Promise<AdminUserDto> {
    const current = this.items.find((user) => user.id === id)!;
    Object.assign(current, data);
    const { passwordHash: _passwordHash, ...user } = current;
    return user;
  }
}

const actor = (role: PublicAuthUser['role'], id = crypto.randomUUID()): PublicAuthUser => ({
  id,
  username: role.toLowerCase(),
  role,
  status: 'ACTIVE',
});
const seed = (repository: MemoryUsers, role: AdminRoleDto, id = crypto.randomUUID()) => {
  repository.items.push({
    id,
    username: `${role.toLowerCase()}-${repository.items.length}`,
    passwordHash: 'hash',
    role,
    status: 'ACTIVE',
  });
  return id;
};

describe('UsersService', () => {
  it('sólo Dirección puede listar y crear usuarios de cualquier rol', async () => {
    const repository = new MemoryUsers();
    const service = new UsersService(repository);
    await expect(
      service.create(actor('ADMINISTRATOR'), {
        username: 'recepcion',
        password: 'una-clave-segura',
        role: 'RECEPTION',
      }),
    ).resolves.toMatchObject({ role: 'RECEPTION' });
    await expect(
      service.create(actor('MANAGER'), {
        username: 'otra-recepcion',
        password: 'otra-clave-segura',
        role: 'RECEPTION',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(service.list(actor('MANAGER'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('impide auto-desactivarse y eliminar la última Dirección activa', async () => {
    const repository = new MemoryUsers();
    const directionId = seed(repository, 'ADMINISTRATOR');
    const service = new UsersService(repository);
    const direction = actor('ADMINISTRATOR', directionId);
    await expect(
      service.update(direction, directionId, { status: 'INACTIVE' }),
    ).rejects.toMatchObject({ code: 'CANNOT_RESTRICT_SELF' });
    await expect(
      service.update(actor('ADMINISTRATOR'), directionId, { status: 'INACTIVE' }),
    ).rejects.toMatchObject({ code: 'LAST_DIRECTION_USER_REQUIRED' });
  });

  it('exige la contraseña actual de Dirección para desactivar otro usuario', async () => {
    const repository = new MemoryUsers();
    const directionId = crypto.randomUUID();
    repository.items.push({
      id: directionId,
      username: 'direccion',
      passwordHash: await hashPassword('clave-direccion-segura'),
      role: 'ADMINISTRATOR',
      status: 'ACTIVE',
    });
    const receptionId = seed(repository, 'RECEPTION');
    const service = new UsersService(repository);
    const direction = actor('ADMINISTRATOR', directionId);

    await expect(
      service.update(direction, receptionId, {
        status: 'INACTIVE',
        currentPassword: 'incorrecta',
      }),
    ).rejects.toMatchObject({ code: 'CURRENT_PASSWORD_INVALID' });
    await expect(
      service.update(direction, receptionId, {
        status: 'INACTIVE',
        currentPassword: 'clave-direccion-segura',
      }),
    ).resolves.toMatchObject({ status: 'INACTIVE' });
  });
});
