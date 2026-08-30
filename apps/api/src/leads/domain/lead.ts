import type { LeadSourceDto, LeadStatusDto } from '@academy/contracts';
import { DomainError } from '../../shared/domain/domain-error';

export const leadSources: readonly LeadSourceDto[] = ['WHATSAPP', 'INSTAGRAM', 'IN_PERSON'];
export const leadStatuses: readonly LeadStatusDto[] = [
  'INQUIRY',
  'INTERESTED',
  'TRIAL',
  'ENROLLED',
  'NOT_CONVERTED',
];
export const openLeadStatuses: readonly LeadStatusDto[] = ['INQUIRY', 'INTERESTED', 'TRIAL'];

export type LeadData = Readonly<{
  id: string;
  name: string;
  phone: string | null;
  normalizedPhone: string | null;
  email: string | null;
  normalizedEmail: string | null;
  instagram: string | null;
  normalizedInstagram: string | null;
  source: LeadSourceDto;
  status: LeadStatusDto;
  notes: string | null;
  nextFollowUpAt: Date | null;
  lastContactAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;
export type LeadInput = Readonly<{
  name: unknown;
  source: unknown;
  phone?: unknown;
  email?: unknown;
  instagram?: unknown;
  status?: unknown;
  notes?: unknown;
  nextFollowUpAt?: unknown;
  lastContactAt?: unknown;
}>;
export type ValidatedLeadInput = Omit<LeadData, 'id' | 'createdAt' | 'updatedAt'>;

const optionalText = (value: unknown, field: string, maximum: number) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string')
    throw new DomainError('VALIDATION_ERROR', `${field} debe ser texto`, { field });
  const result = value.trim();
  if (result.length > maximum)
    throw new DomainError('VALIDATION_ERROR', `${field} no puede superar ${maximum} caracteres`, {
      field,
    });
  return result || null;
};
const optionalDate = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))
    throw new DomainError('VALIDATION_ERROR', `${field} debe ser una fecha y hora válida`, {
      field,
    });
  const result = new Date(value);
  if (Number.isNaN(result.getTime()))
    throw new DomainError('VALIDATION_ERROR', `${field} debe ser una fecha y hora válida`, {
      field,
    });
  return result;
};

export const normalizeLeadPhone = (value: string | null) => value?.replace(/\D/g, '') || null;
export const normalizeLeadEmail = (value: string | null) => value?.trim().toLowerCase() || null;
export const normalizeLeadInstagram = (value: string | null) =>
  value?.trim().replace(/^@+/, '').toLowerCase() || null;

export function validateLeadInput(input: LeadInput): ValidatedLeadInput {
  const name = optionalText(input.name, 'name', 180);
  if (!name)
    throw new DomainError('VALIDATION_ERROR', 'El nombre es obligatorio', { field: 'name' });
  if (!leadSources.includes(input.source as LeadSourceDto))
    throw new DomainError('VALIDATION_ERROR', 'El origen no es válido', { field: 'source' });
  const status = input.status ?? 'INQUIRY';
  if (!leadStatuses.includes(status as LeadStatusDto))
    throw new DomainError('VALIDATION_ERROR', 'El estado no es válido', { field: 'status' });
  const phone = optionalText(input.phone, 'phone', 80);
  const email = optionalText(input.email, 'email', 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new DomainError('VALIDATION_ERROR', 'El correo no es válido', { field: 'email' });
  const instagram = optionalText(input.instagram, 'instagram', 100);
  return {
    name,
    phone,
    normalizedPhone: normalizeLeadPhone(phone),
    email,
    normalizedEmail: normalizeLeadEmail(email),
    instagram,
    normalizedInstagram: normalizeLeadInstagram(instagram),
    source: input.source as LeadSourceDto,
    status: status as LeadStatusDto,
    notes: optionalText(input.notes, 'notes', 4000),
    nextFollowUpAt: optionalDate(input.nextFollowUpAt, 'nextFollowUpAt'),
    lastContactAt: optionalDate(input.lastContactAt, 'lastContactAt'),
  };
}
