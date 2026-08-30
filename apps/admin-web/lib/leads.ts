import type { LeadDto, LeadSourceDto, LeadStatusDto } from '@academy/contracts';

export const leadStatusLabels: Readonly<Record<LeadStatusDto, string>> = {
  INQUIRY: 'Consulta',
  INTERESTED: 'Interesado/a',
  TRIAL: 'Clase de prueba',
  ENROLLED: 'Inscripto/a',
  NOT_CONVERTED: 'No concretó',
};
export const leadSourceLabels: Readonly<Record<LeadSourceDto, string>> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  IN_PERSON: 'Presencial',
};
export const leadStatusClass: Readonly<Record<LeadStatusDto, string>> = {
  INQUIRY: 'inactive',
  INTERESTED: 'lead-interested',
  TRIAL: 'lead-trial',
  ENROLLED: 'active',
  NOT_CONVERTED: 'inactive',
};
export const leadPrimaryContact = (lead: Pick<LeadDto, 'phone' | 'email' | 'instagram'>) =>
  lead.phone || lead.email || (lead.instagram ? `@${lead.instagram.replace(/^@/, '')}` : '—');
export const isLeadFollowUpOverdue = (lead: LeadDto, now: Date) =>
  Boolean(
    lead.nextFollowUpAt &&
      new Date(lead.nextFollowUpAt) < now &&
      lead.status !== 'ENROLLED' &&
      lead.status !== 'NOT_CONVERTED',
  );
export const localDateTimeValue = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};
