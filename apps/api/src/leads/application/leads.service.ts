import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../shared/domain/domain-error';
import {
  normalizeLeadEmail,
  normalizeLeadInstagram,
  normalizeLeadPhone,
  validateLeadInput,
  type LeadInput,
} from '../domain/lead';
import {
  LEAD_REPOSITORY,
  type LeadDuplicateQuery,
  type LeadListQuery,
  type LeadRepository,
} from './lead.repository';

@Injectable()
export class LeadsService {
  constructor(@Inject(LEAD_REPOSITORY) private readonly repository: LeadRepository) {}
  list(query: LeadListQuery) {
    return this.repository.findPage(query);
  }
  async get(id: string) {
    const lead = await this.repository.findById(id);
    if (!lead) throw new DomainError('LEAD_NOT_FOUND', 'Potencial alumno no encontrado');
    return lead;
  }
  create(input: LeadInput) {
    return this.repository.create(validateLeadInput(input));
  }
  async update(id: string, patch: Partial<LeadInput>, actorId: string) {
    const current = await this.get(id);
    return this.repository.update(
      id,
      validateLeadInput({
        name: patch.name ?? current.name,
        source: patch.source ?? current.source,
        phone: patch.phone === undefined ? current.phone : patch.phone,
        email: patch.email === undefined ? current.email : patch.email,
        instagram: patch.instagram === undefined ? current.instagram : patch.instagram,
        status: patch.status ?? current.status,
        notes: patch.notes === undefined ? current.notes : patch.notes,
        nextFollowUpAt:
          patch.nextFollowUpAt === undefined
            ? (current.nextFollowUpAt?.toISOString() ?? null)
            : patch.nextFollowUpAt,
        lastContactAt:
          patch.lastContactAt === undefined
            ? (current.lastContactAt?.toISOString() ?? null)
            : patch.lastContactAt,
      }),
      actorId,
    );
  }
  duplicates(query: LeadDuplicateQuery) {
    const phone = query.phone ? normalizeLeadPhone(query.phone) : null;
    const email = query.email ? normalizeLeadEmail(query.email) : null;
    const instagram = query.instagram ? normalizeLeadInstagram(query.instagram) : null;
    return this.repository.findDuplicates({
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      ...(instagram ? { instagram } : {}),
      ...(query.excludeId ? { excludeId: query.excludeId } : {}),
    });
  }
}
