import type { AdminRoleDto, AdminUserDto, RecordStatusDto } from '@academy/contracts';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export type UserWithPassword = AdminUserDto & { passwordHash: string };

export interface UserRepository {
  list(): Promise<AdminUserDto[]>;
  findById(id: string): Promise<UserWithPassword | null>;
  findByUsername(username: string): Promise<UserWithPassword | null>;
  countActiveDirectionUsers(): Promise<number>;
  create(data: {
    username: string;
    passwordHash: string;
    role: AdminRoleDto;
  }): Promise<AdminUserDto>;
  update(
    id: string,
    data: {
      username: string;
      passwordHash?: string;
      role: AdminRoleDto;
      status: RecordStatusDto;
    },
  ): Promise<AdminUserDto>;
}
