import type { LeadDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import {
  isLeadFollowUpOverdue,
  leadPrimaryContact,
  leadSourceLabels,
  leadStatusLabels,
} from './leads';

const lead = (patch: Partial<LeadDto> = {}) =>
  ({
    id: crypto.randomUUID(),
    name: 'Ana',
    phone: null,
    email: null,
    instagram: null,
    source: 'WHATSAPP',
    status: 'INQUIRY',
    notes: null,
    nextFollowUpAt: null,
    lastContactAt: null,
    createdAt: '2026-08-30T10:00:00.000Z',
    updatedAt: '2026-08-30T10:00:00.000Z',
    ...patch,
  }) as LeadDto;

describe('leads presentation', () => {
  it('presenta estados y orígenes con labels en español', () => {
    expect(leadStatusLabels).toEqual({
      INQUIRY: 'Consulta',
      INTERESTED: 'Interesado/a',
      TRIAL: 'Clase de prueba',
      ENROLLED: 'Inscripto/a',
      NOT_CONVERTED: 'No concretó',
    });
    expect(leadSourceLabels).toMatchObject({ WHATSAPP: 'WhatsApp', IN_PERSON: 'Presencial' });
  });
  it('elige un contacto principal sin exigir teléfono', () => {
    expect(leadPrimaryContact(lead({ email: 'ana@example.com' }))).toBe('ana@example.com');
    expect(leadPrimaryContact(lead({ instagram: '@ana' }))).toBe('@ana');
  });
  it('deriva seguimiento vencido sólo para etapas abiertas', () => {
    const now = new Date('2026-08-30T15:00:00.000Z');
    expect(isLeadFollowUpOverdue(lead({ nextFollowUpAt: '2026-08-30T14:00:00.000Z' }), now)).toBe(
      true,
    );
    expect(
      isLeadFollowUpOverdue(
        lead({ status: 'ENROLLED', nextFollowUpAt: '2026-08-30T14:00:00.000Z' }),
        now,
      ),
    ).toBe(false);
    expect(
      isLeadFollowUpOverdue(
        lead({ status: 'NOT_CONVERTED', nextFollowUpAt: '2026-08-30T14:00:00.000Z' }),
        now,
      ),
    ).toBe(false);
  });
});
