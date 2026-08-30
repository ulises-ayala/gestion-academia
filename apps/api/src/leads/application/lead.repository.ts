import type { LeadSourceDto, LeadStatusDto } from '@academy/contracts';
import type { LeadData, ValidatedLeadInput } from '../domain/lead';

export const LEAD_REPOSITORY = Symbol('LEAD_REPOSITORY');
export type LeadFollowUpFilter = 'PENDING' | 'OVERDUE';
export type LeadListQuery = Readonly<{
  q?: string;
  status?: LeadStatusDto;
  source?: LeadSourceDto;
  followUp?: LeadFollowUpFilter;
  now: Date;
  page: number;
  pageSize: number;
}>;
export type LeadPage = Readonly<{
  items: LeadData[];
  total: number;
  page: number;
  pageSize: number;
}>;
export type LeadDuplicateQuery = Readonly<{
  phone?: string;
  email?: string;
  instagram?: string;
  excludeId?: string;
}>;
export type LeadDuplicate = Readonly<{
  lead: LeadData;
  matches: Array<'phone' | 'email' | 'instagram'>;
}>;

export interface LeadRepository {
  create(input: ValidatedLeadInput): Promise<LeadData>;
  findPage(query: LeadListQuery): Promise<LeadPage>;
  findById(id: string): Promise<LeadData | null>;
  findDuplicates(query: LeadDuplicateQuery): Promise<LeadDuplicate[]>;
  update(id: string, input: ValidatedLeadInput, actorId: string): Promise<LeadData>;
}
