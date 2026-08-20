import { Inject, Injectable } from '@nestjs/common';
import type { AdminUser } from '@academy/database';
import { PrismaService } from '../../database/prisma.service';
import type { AuthRepository, AuthUser } from '../application/auth.repository';

const toAuthUser = (user: AdminUser): AuthUser => ({
  id: user.id,
  username: user.username,
  passwordHash: user.passwordHash,
  role: user.role,
  status: user.status,
});

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  countUsers(): Promise<number> { return this.prisma.adminUser.count(); }

  async findUserByUsername(username: string): Promise<AuthUser | null> {
    const user = await this.prisma.adminUser.findUnique({ where: { username } });
    return user ? toAuthUser(user) : null;
  }

  async createAdministrator(username: string, passwordHash: string): Promise<AuthUser> {
    return toAuthUser(await this.prisma.adminUser.create({ data: { username, passwordHash, role: 'ADMINISTRATOR' } }));
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.adminSession.create({ data: { userId, tokenHash, expiresAt } });
  }

  async findUserBySession(tokenHash: string, now: Date): Promise<AuthUser | null> {
    const session = await this.prisma.adminSession.findFirst({ where: { tokenHash, expiresAt: { gt: now } }, include: { user: true } });
    return session ? toAuthUser(session.user) : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.prisma.adminSession.deleteMany({ where: { tokenHash } });
  }
}
