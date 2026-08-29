import type { AuditLogListDto } from '@academy/contracts';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@academy/database';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../shared/domain/domain-error';

export type AuditQuery = {
  entityType?: string;
  entityId?: string;
  action?: string;
  actorUserId?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async list(query: AuditQuery): Promise<AuditLogListDto> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, username: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        before: item.before as Record<string, unknown> | null,
        after: item.after as Record<string, unknown> | null,
        metadata: item.metadata as Record<string, unknown> | null,
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  parseDate(value: string | undefined, field: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new DomainError('VALIDATION_ERROR', `${field} no es una fecha válida`, { field });
    return date;
  }
}
