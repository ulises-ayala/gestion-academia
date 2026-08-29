import type { AdminUser } from '@academy/database';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { UserRepository, UserWithPassword } from '../application/user.repository';

const map = (user: AdminUser): UserWithPassword => ({
  id: user.id,
  username: user.username,
  passwordHash: user.passwordHash,
  role: user.role,
  status: user.status,
});
const publicUser = (user: AdminUser) => {
  const { passwordHash: _passwordHash, ...item } = map(user);
  return item;
};

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list() {
    return (await this.prisma.adminUser.findMany({ orderBy: { username: 'asc' } })).map(publicUser);
  }
  async findById(id: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id } });
    return user ? map(user) : null;
  }
  async findByUsername(username: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { username } });
    return user ? map(user) : null;
  }
  countActiveDirectionUsers() {
    return this.prisma.adminUser.count({ where: { role: 'ADMINISTRATOR', status: 'ACTIVE' } });
  }
  async create(data: Parameters<typeof this.prisma.adminUser.create>[0]['data']) {
    return publicUser(await this.prisma.adminUser.create({ data }));
  }
  async update(
    id: string,
    data: Parameters<typeof this.prisma.adminUser.update>[0]['data'],
    actorId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.adminUser.findUniqueOrThrow({ where: { id } });
      const updated = await tx.adminUser.update({ where: { id }, data });
      if (actorId)
        await tx.auditLog.create({
          data: {
            actorUserId: actorId,
            action:
              before.role !== updated.role
                ? 'ROLE_CHANGE'
                : before.status !== updated.status
                  ? 'STATUS_CHANGE'
                  : 'UPDATE',
            entityType: 'ADMIN_USER',
            entityId: id,
            before: { username: before.username, role: before.role, status: before.status },
            after: {
              username: updated.username,
              role: updated.role,
              status: updated.status,
              ...(data.passwordHash ? { passwordChanged: true } : {}),
            },
          },
        });
      return publicUser(updated);
    });
  }
}
