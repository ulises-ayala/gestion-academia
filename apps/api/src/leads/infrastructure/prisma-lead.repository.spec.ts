import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import { PrismaLeadRepository } from './prisma-lead.repository';

describe('PrismaLeadRepository', () => {
  const now = new Date('2026-08-30T15:00:00.000Z');
  const lead = {
    id: crypto.randomUUID(),
    name: 'Ana',
    phone: '+54 11 5555 1234',
    normalizedPhone: '541155551234',
    email: 'ana@example.com',
    normalizedEmail: 'ana@example.com',
    instagram: '@ana',
    normalizedInstagram: 'ana',
    source: 'WHATSAPP' as const,
    status: 'INQUIRY' as const,
    notes: null,
    nextFollowUpAt: null,
    lastContactAt: null,
    createdAt: now,
    updatedAt: now,
  };
  it('deriva vencidos sólo entre estados abiertos y pagina en servidor', async () => {
    const findMany = vi.fn(async () => []);
    const count = vi.fn(async () => 0);
    const repository = new PrismaLeadRepository({
      lead: { findMany, count },
      $transaction: vi.fn(async (operations) => Promise.all(operations)),
    } as unknown as PrismaService);
    await repository.findPage({ followUp: 'OVERDUE', now, page: 2, pageSize: 25 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              status: { in: ['INQUIRY', 'INTERESTED', 'TRIAL'] },
              nextFollowUpAt: { lt: now },
            },
          ],
        },
        skip: 25,
        take: 25,
      }),
    );
  });
  it('combina búsqueda por nombre/contacto con filtros de estado y origen', async () => {
    const findMany = vi.fn(async () => []);
    const repository = new PrismaLeadRepository({
      lead: { findMany, count: vi.fn(async () => 0) },
      $transaction: vi.fn(async (operations) => Promise.all(operations)),
    } as unknown as PrismaService);
    await repository.findPage({
      q: '+54 11',
      status: 'INTERESTED',
      source: 'INSTAGRAM',
      now,
      page: 1,
      pageSize: 10,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { status: 'INTERESTED' },
            { source: 'INSTAGRAM' },
            expect.objectContaining({
              OR: expect.arrayContaining([
                { name: { contains: '+54 11', mode: 'insensitive' } },
                { normalizedPhone: { contains: '5411' } },
              ]),
            }),
          ],
        },
      }),
    );
  });
  it('audita atómicamente una modificación relevante y su cambio de estado', async () => {
    const auditCreate = vi.fn(async () => ({}));
    const updated = { ...lead, status: 'TRIAL' as const, notes: 'Coordinó prueba' };
    const transaction = {
      lead: {
        findUniqueOrThrow: vi.fn(async () => lead),
        update: vi.fn(async () => updated),
      },
      auditLog: { create: auditCreate },
    };
    const repository = new PrismaLeadRepository({
      $transaction: vi.fn(async (operation) => operation(transaction)),
    } as unknown as PrismaService);
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = updated;
    await repository.update(lead.id, input, crypto.randomUUID());
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'STATUS_CHANGE',
          entityType: 'LEAD',
          entityId: lead.id,
          before: expect.objectContaining({ status: 'INQUIRY' }),
          after: expect.objectContaining({ status: 'TRIAL' }),
        }),
      }),
    );
  });
});
