import type { CreateAdminUserDto, UpdateAdminUserDto } from '@academy/contracts';
import { Inject, Injectable } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { hashPassword, validatePassword, verifyPassword } from '../../auth/domain/password';
import { DomainError } from '../../shared/domain/domain-error';
import { normalizeAdminUsername } from '../domain/user';
import { USER_REPOSITORY, type UserRepository } from './user.repository';

@Injectable()
export class UsersService {
  constructor(@Inject(USER_REPOSITORY) private readonly repository: UserRepository) {}

  async list(actor: PublicAuthUser) {
    this.assertDirection(actor);
    const users = await this.repository.list();
    return users;
  }
  async get(actor: PublicAuthUser, id: string) {
    this.assertDirection(actor);
    const user = await this.repository.findById(id);
    if (!user) throw new DomainError('ADMIN_USER_NOT_FOUND', 'Usuario no encontrado');
    this.assertCanManageRole(actor, user.role);
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }
  async create(actor: PublicAuthUser, input: CreateAdminUserDto) {
    this.assertDirection(actor);
    this.assertCanManageRole(actor, input.role);
    const username = normalizeAdminUsername(input.username);
    if (await this.repository.findByUsername(username))
      throw new DomainError('USERNAME_ALREADY_EXISTS', 'Ya existe un usuario con ese nombre', {
        field: 'username',
      });
    return this.repository.create({
      username,
      passwordHash: await hashPassword(validatePassword(input.password)),
      role: input.role,
    });
  }
  async update(actor: PublicAuthUser, id: string, patch: UpdateAdminUserDto) {
    this.assertDirection(actor);
    const current = await this.repository.findById(id);
    if (!current) throw new DomainError('ADMIN_USER_NOT_FOUND', 'Usuario no encontrado');
    this.assertCanManageRole(actor, current.role);
    const role = patch.role ?? current.role;
    this.assertCanManageRole(actor, role);
    if (actor.id === id && (role !== current.role || patch.status === 'INACTIVE'))
      throw new DomainError(
        'CANNOT_RESTRICT_SELF',
        'No podés cambiar tu propio rol ni desactivar tu cuenta',
      );
    if (
      current.role === 'ADMINISTRATOR' &&
      current.status === 'ACTIVE' &&
      (role !== 'ADMINISTRATOR' || patch.status === 'INACTIVE') &&
      (await this.repository.countActiveDirectionUsers()) <= 1
    )
      throw new DomainError(
        'LAST_DIRECTION_USER_REQUIRED',
        'Debe permanecer al menos un usuario de Dirección activo',
      );
    if (current.status === 'ACTIVE' && patch.status === 'INACTIVE') {
      const direction = await this.repository.findById(actor.id);
      if (
        !direction ||
        !(await verifyPassword(
          typeof patch.currentPassword === 'string' ? patch.currentPassword : '',
          direction.passwordHash,
        ))
      )
        throw new DomainError(
          'CURRENT_PASSWORD_INVALID',
          'La contraseña actual de Dirección es incorrecta',
          { field: 'currentPassword' },
        );
    }
    const username =
      patch.username === undefined ? current.username : normalizeAdminUsername(patch.username);
    const duplicate = await this.repository.findByUsername(username);
    if (duplicate && duplicate.id !== id)
      throw new DomainError('USERNAME_ALREADY_EXISTS', 'Ya existe un usuario con ese nombre', {
        field: 'username',
      });
    return this.repository.update(
      id,
      {
        username,
        ...(patch.password
          ? { passwordHash: await hashPassword(validatePassword(patch.password)) }
          : {}),
        role,
        status: patch.status ?? current.status,
      },
      actor.id,
    );
  }
  private assertCanManageRole(actor: PublicAuthUser, role: PublicAuthUser['role']) {
    if (actor.role === 'RECEPTION' || (role === 'ADMINISTRATOR' && actor.role !== 'ADMINISTRATOR'))
      throw new DomainError('FORBIDDEN', 'No tenés permisos para gestionar ese nivel de acceso');
  }
  private assertDirection(actor: PublicAuthUser) {
    if (actor.role !== 'ADMINISTRATOR')
      throw new DomainError('FORBIDDEN', 'Sólo Dirección puede gestionar usuarios y roles');
  }
}
