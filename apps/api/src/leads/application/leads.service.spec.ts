import { describe, expect, it } from 'vitest';
import type { LeadDuplicateQuery, LeadListQuery, LeadRepository } from './lead.repository';
import { LeadsService } from './leads.service';
import type { LeadData, ValidatedLeadInput } from '../domain/lead';

const stored = (input: ValidatedLeadInput): LeadData => ({
  id: crypto.randomUUID(),
  ...input,
  createdAt: new Date(),
  updatedAt: new Date(),
});
class MemoryLeads implements LeadRepository {
  items: LeadData[] = [];
  audits: string[] = [];
  async create(input: ValidatedLeadInput) {
    const lead = stored(input);
    this.items.push(lead);
    return lead;
  }
  async findPage(query: LeadListQuery) {
    return {
      items: this.items,
      total: this.items.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async findById(id: string) {
    return this.items.find((item) => item.id === id) ?? null;
  }
  async findDuplicates(query: LeadDuplicateQuery) {
    return this.items
      .filter((item) =>
        Boolean(
          (query.phone && item.normalizedPhone === query.phone) ||
            (query.email && item.normalizedEmail === query.email) ||
            (query.instagram && item.normalizedInstagram === query.instagram),
        ),
      )
      .map((lead) => ({ lead, matches: ['phone' as const] }));
  }
  async update(id: string, input: ValidatedLeadInput, actorId: string) {
    const lead = stored(input);
    const updated = { ...lead, id };
    this.items = this.items.map((item) => (item.id === id ? updated : item));
    this.audits.push(actorId);
    return updated;
  }
}

describe('LeadsService', () => {
  it('crea, obtiene y cambia estado sin imponer transiciones', async () => {
    const repository = new MemoryLeads();
    const service = new LeadsService(repository);
    const created = await service.create({ name: 'Ana', source: 'WHATSAPP' });
    expect(created.status).toBe('INQUIRY');
    await expect(
      service.update(created.id, { status: 'ENROLLED' }, 'actor'),
    ).resolves.toMatchObject({
      status: 'ENROLLED',
    });
    await expect(
      service.update(created.id, { status: 'INTERESTED' }, 'actor'),
    ).resolves.toMatchObject({
      status: 'INTERESTED',
    });
    expect(repository.audits).toEqual(['actor', 'actor']);
  });
  it('normaliza la consulta preventiva sin bloquear la creación', async () => {
    const repository = new MemoryLeads();
    const service = new LeadsService(repository);
    await service.create({ name: 'Ana', source: 'WHATSAPP', phone: '+54 11 5555-1234' });
    await expect(service.duplicates({ phone: '(5411) 5555 1234' })).resolves.toHaveLength(1);
    await expect(
      service.create({ name: 'Familiar de Ana', source: 'WHATSAPP', phone: '+54 11 5555-1234' }),
    ).resolves.toMatchObject({ name: 'Familiar de Ana' });
  });
  it('rechaza un potencial inexistente', async () => {
    await expect(
      new LeadsService(new MemoryLeads()).get(crypto.randomUUID()),
    ).rejects.toMatchObject({
      code: 'LEAD_NOT_FOUND',
    });
  });
});
