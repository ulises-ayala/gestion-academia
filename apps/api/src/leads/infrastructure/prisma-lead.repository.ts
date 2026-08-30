import { Prisma, type Lead } from '@academy/database';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  LeadDuplicate,
  LeadDuplicateQuery,
  LeadListQuery,
  LeadPage,
  LeadRepository,
} from '../application/lead.repository';
import { openLeadStatuses, type LeadData, type ValidatedLeadInput } from '../domain/lead';

const toDomain = (lead: Lead): LeadData => lead;
const snapshot = (lead: Lead) => ({
  name: lead.name,
  phone: lead.phone,
  email: lead.email,
  instagram: lead.instagram,
  source: lead.source,
  status: lead.status,
  notes: lead.notes,
  nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
  lastContactAt: lead.lastContactAt?.toISOString() ?? null,
});

@Injectable()
export class PrismaLeadRepository implements LeadRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: ValidatedLeadInput) {
    return toDomain(await this.prisma.lead.create({ data: input }));
  }

  async findPage(query: LeadListQuery): Promise<LeadPage> {
    const where = this.buildWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);
    return { items: items.map(toDomain), total, page: query.page, pageSize: query.pageSize };
  }

  async findById(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    return lead ? toDomain(lead) : null;
  }

  async findDuplicates(query: LeadDuplicateQuery): Promise<LeadDuplicate[]> {
    const clauses: Prisma.LeadWhereInput[] = [];
    if (query.phone) clauses.push({ normalizedPhone: query.phone });
    if (query.email) clauses.push({ normalizedEmail: query.email });
    if (query.instagram) clauses.push({ normalizedInstagram: query.instagram });
    if (!clauses.length) return [];
    const leads = await this.prisma.lead.findMany({
      where: { OR: clauses, ...(query.excludeId ? { id: { not: query.excludeId } } : {}) },
      orderBy: [{ updatedAt: 'desc' }],
      take: 10,
    });
    return leads.map((lead) => ({
      lead: toDomain(lead),
      matches: [
        ...(query.phone && lead.normalizedPhone === query.phone ? (['phone'] as const) : []),
        ...(query.email && lead.normalizedEmail === query.email ? (['email'] as const) : []),
        ...(query.instagram && lead.normalizedInstagram === query.instagram
          ? (['instagram'] as const)
          : []),
      ],
    }));
  }

  async update(id: string, input: ValidatedLeadInput, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.lead.findUniqueOrThrow({ where: { id } });
      const updated = await tx.lead.update({ where: { id }, data: input });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: before.status === updated.status ? 'UPDATE' : 'STATUS_CHANGE',
          entityType: 'LEAD',
          entityId: id,
          before: snapshot(before),
          after: snapshot(updated),
        },
      });
      return toDomain(updated);
    });
  }

  private buildWhere(query: LeadListQuery): Prisma.LeadWhereInput {
    const filters: Prisma.LeadWhereInput[] = [];
    if (query.status) filters.push({ status: query.status });
    if (query.source) filters.push({ source: query.source });
    if (query.followUp) {
      filters.push({
        status: { in: [...openLeadStatuses] },
        nextFollowUpAt: query.followUp === 'OVERDUE' ? { lt: query.now } : { not: null },
      });
    }
    const q = query.q?.trim();
    if (q) {
      const digits = q.replace(/\D/g, '');
      const normalizedInstagram = q.replace(/^@+/, '').toLowerCase();
      filters.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { instagram: { contains: q, mode: 'insensitive' } },
          ...(digits ? [{ normalizedPhone: { contains: digits } }] : []),
          { normalizedEmail: { contains: q.toLowerCase() } },
          { normalizedInstagram: { contains: normalizedInstagram } },
        ],
      });
    }
    return filters.length ? { AND: filters } : {};
  }
}
