import type {
  MessageRecipientsDto,
  MessageSituationSummaryDto,
  MessageTemplateDto,
} from '@academy/contracts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SituationNav, SituationPanel } from './messages-view';

const variables = [
  { key: 'nombre', label: 'nombre' },
  { key: 'cuotas', label: 'cuotas' },
  { key: 'saldo_vencido', label: 'saldo vencido' },
  { key: 'vencimiento', label: 'vencimiento' },
];
const situationsFixture: MessageSituationSummaryDto[] = [
  {
    situation: 'CHARGE_DUE_SOON',
    group: 'Pagos',
    label: 'Cuota por vencer',
    description: '',
    variables,
    count: 12,
  },
  {
    situation: 'CHARGE_OVERDUE',
    group: 'Pagos',
    label: 'Cuota vencida',
    description: 'Alumnos con al menos una cuota vencida hoy.',
    variables,
    count: 4,
  },
  {
    situation: 'ABSENCES',
    group: 'Asistencia',
    label: 'Faltó varias veces',
    description: '',
    variables,
    count: 5,
  },
  {
    situation: 'BIRTHDAY',
    group: 'Comunidad',
    label: 'Cumpleaños',
    description: '',
    variables,
    count: 3,
  },
  {
    situation: 'LEAD_NO_TRIAL',
    group: 'Potenciales',
    label: 'Consultó y no vino',
    description: '',
    variables,
    count: 9,
  },
];
const template: MessageTemplateDto = {
  id: 't1',
  situation: 'CHARGE_OVERDUE',
  name: 'Recordatorio amable',
  body: 'Hola {nombre} 👋💃\nTe escribimos de *Carmesí*. Nos figura pendiente {cuotas} por {saldo_vencido} (la más antigua venció el {vencimiento}).\n\nSi ya pagaste, avisanos. ¡Gracias! ❤️',
  status: 'ACTIVE',
};
const recipient = (
  id: string,
  name: string,
  phone: string | null,
  sent = false,
): MessageRecipientsDto['recipients'][number] => ({
  kind: 'STUDENT',
  id,
  name,
  phone,
  detail: '2 cuotas · $ 80.000,00 · venció el 10/10',
  variables: {
    nombre: name.split(' ')[0]!,
    cuotas: '2 cuotas',
    saldo_vencido: '$ 80.000,00',
    vencimiento: '10/10',
  },
  lastSend: sent
    ? { sentAt: '2026-11-07T15:00:00.000Z', sentBy: 'adriana', templateName: 'Recordatorio amable' }
    : null,
});
const recipientsFixture: MessageRecipientsDto = {
  situation: 'CHARGE_OVERDUE',
  businessDate: '2026-11-10',
  recipients: [
    recipient('s1', 'Ana Pérez', '370 503-2792'),
    recipient('s2', 'Bruno Díaz', '370 441-9087'),
    recipient('s3', 'Carla Medina', null),
    recipient('s4', 'Dana Ríos', '370 512-3344', true),
  ],
  templates: [template, { ...template, id: 't2', name: 'Segundo aviso' }],
};

const panel = (overrides: Partial<React.ComponentProps<typeof SituationPanel>> = {}) =>
  renderToStaticMarkup(
    <SituationPanel
      canManage
      data={recipientsFixture}
      filter="pending"
      now={new Date('2026-11-10T15:00:00.000Z')}
      onEdit={() => undefined}
      onFilter={() => undefined}
      onSend={() => undefined}
      onTemplate={() => undefined}
      summary={situationsFixture[1]!}
      template={template}
      {...overrides}
    />,
  );

describe('Mensajes', () => {
  it('agrupa las situaciones y marca la elegida', () => {
    const html = renderToStaticMarkup(
      <SituationNav
        onSelect={() => undefined}
        selected="CHARGE_OVERDUE"
        situations={situationsFixture}
      />,
    );
    expect(html.match(/<h2>/g)).toHaveLength(4);
    expect(html).toMatch(/aria-current="true"[^>]*>Cuota vencida<span class="msg-count">4</);
  });

  it('muestra el mensaje completado y el enlace de WhatsApp de cada alumno sin avisar', () => {
    const html = panel();
    expect(html).toContain('Hola <mark>Ana</mark> 👋💃');
    expect(html).toContain('Así le llega a <strong>Ana Pérez</strong>');
    expect(html).toContain('Sin avisar · 3');
    expect(html).toContain('Avisados · 1');
    expect(html).toContain('https://wa.me/5493705032792?text=Hola%20Ana%20');
    expect(html).toContain('Enviar por WhatsApp');
    // Sin teléfono no hay enlace: se ofrece cargarlo.
    expect(html).toMatch(/Carla Medina[\s\S]*Sin teléfono cargado[\s\S]*Cargar teléfono/);
    expect(html).not.toContain('Dana Ríos');
  });

  it('los avisados muestran cuándo y quién, y se puede volver a enviar', () => {
    const html = panel({ filter: 'sent' });
    expect(html).toContain('Dana Ríos');
    expect(html).toContain('Hace 3 días · adriana');
    expect(html).toContain('Volver a enviar');
    expect(html).not.toContain('Ana Pérez</a>');
  });

  it('Admisión envía pero no edita los mensajes', () => {
    const html = panel({ canManage: false });
    expect(html).toContain('Enviar por WhatsApp');
    expect(html).not.toContain('Editar mensaje');
    expect(html).not.toContain('Nuevo mensaje');
  });

  it('sin mensaje o sin personas lo dice', () => {
    expect(panel({ template: null })).toContain('todavía no tiene un mensaje');
    expect(panel({ data: { ...recipientsFixture, recipients: [] } })).toContain(
      'Hoy no hay nadie en esta situación.',
    );
  });
});
