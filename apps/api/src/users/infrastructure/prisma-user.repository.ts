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
  async update(id: string, data: Parameters<typeof this.prisma.adminUser.update>[0]['data']) {
    return publicUser(await this.prisma.adminUser.update({ where: { id }, data }));
  }
}
