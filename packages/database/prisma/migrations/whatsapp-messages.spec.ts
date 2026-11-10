import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261110120000_whatsapp_messages/migration.sql', import.meta.url),
  'utf8',
);
const situations = [
  'CHARGE_DUE_SOON',
  'CHARGE_OVERDUE',
  'ABSENCES',
  'DROPPED',
  'WELCOME',
  'BIRTHDAY',
  'LEAD_NO_TRIAL',
  'LEAD_TRIAL_NOT_ENROLLED',
];

describe('Mensajes de WhatsApp', () => {
  it('crea las plantillas, el registro de envíos y un mensaje inicial por situación', () => {
    expect(migration).toContain('CREATE TYPE "MessageSituation"');
    expect(migration).toContain('CREATE TABLE "message_templates"');
    expect(migration).toContain('CREATE TABLE "message_sends"');
    for (const situation of situations) expect(migration).toContain(`('${situation}', '`);
    // El destinatario es un alumno o un potencial, nunca los dos.
    expect(migration).toContain('CHECK (("student_id" IS NULL) <> ("lead_id" IS NULL))');
    expect(migration).not.toMatch(/DROP\s+|DELETE\s+FROM/i);
  });

  it('los mensajes iniciales solo usan los datos de su situación', () => {
    const allowed: Record<string, string[]> = {
      CHARGE_DUE_SOON: ['nombre', 'cuotas', 'saldo', 'vencimiento'],
      CHARGE_OVERDUE: ['nombre', 'cuotas', 'saldo_vencido', 'vencimiento', 'saldo_total'],
      ABSENCES: ['nombre', 'clase', 'ausencias'],
      DROPPED: ['nombre', 'clase'],
      WELCOME: ['nombre', 'clase'],
      BIRTHDAY: ['nombre'],
      LEAD_NO_TRIAL: ['nombre'],
      LEAD_TRIAL_NOT_ENROLLED: ['nombre', 'clase'],
    };
    const rows = [...migration.matchAll(/\('([A-Z_]+)', '[^']+', E'((?:[^']|'')*)', \d+\)/g)];
    expect(rows.length).toBeGreaterThanOrEqual(situations.length);
    for (const [, situation, body] of rows)
      for (const [, key] of body!.matchAll(/\{([^{}\s]+)\}/g))
        expect(allowed[situation!], `${situation}: {${key}}`).toContain(key);
  });
});
