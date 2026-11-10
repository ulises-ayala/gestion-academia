'use client';

import type {
  MessageRecipientDto,
  MessageRecipientsDto,
  MessageSituationDto,
  MessageSituationSummaryDto,
  MessageTemplateDto,
  RegisterMessageSendDto,
} from '@academy/contracts';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../components/auth-provider';
import {
  type RecipientFilter,
  SituationNav,
  SituationPanel,
} from '../../components/messages/messages-view';
import { TemplateEditor } from '../../components/messages/template-editor';
import { PageContainer } from '../../components/ui/page-container';
import { ApiClientError, apiRequest } from '../../lib/api-client';

const failure = (error: unknown, fallback: string) =>
  error instanceof ApiClientError ? error.message : fallback;

export default function MessagesPage() {
  const { can } = useAuth();
  const [situations, setSituations] = useState<readonly MessageSituationSummaryDto[]>([]);
  const [selected, setSelected] = useState<MessageSituationDto>('CHARGE_OVERDUE');
  const [data, setData] = useState<MessageRecipientsDto | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RecipientFilter>('pending');
  /** undefined = editor cerrado; null = mensaje nuevo. */
  const [editing, setEditing] = useState<MessageTemplateDto | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSituations = useCallback(async () => {
    try {
      setSituations(await apiRequest<MessageSituationSummaryDto[]>('/messages/situations'));
    } catch (caught) {
      setError(failure(caught, 'No se pudieron cargar los mensajes.'));
    }
  }, []);
  const loadRecipients = useCallback(async (situation: MessageSituationDto) => {
    setLoading(true);
    setError('');
    try {
      setData(
        await apiRequest<MessageRecipientsDto>(`/messages/recipients?situation=${situation}`),
      );
    } catch (caught) {
      setError(failure(caught, 'No se pudo cargar la lista.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void loadSituations(), [loadSituations]);
  useEffect(() => void loadRecipients(selected), [loadRecipients, selected]);

  const summary = situations.find((item) => item.situation === selected);
  const current = data?.situation === selected ? data : null;
  const template =
    current?.templates.find((item) => item.id === templateId) ?? current?.templates[0] ?? null;

  // WhatsApp ya se abrió con el enlace: acá solo queda anotado el envío.
  async function registerSend(recipient: MessageRecipientDto, text: string) {
    const body: RegisterMessageSendDto = {
      situation: selected,
      templateId: template?.id ?? null,
      ...(recipient.kind === 'STUDENT' ? { studentId: recipient.id } : { leadId: recipient.id }),
      body: text,
    };
    try {
      const lastSend = await apiRequest<NonNullable<MessageRecipientDto['lastSend']>>(
        '/messages/sends',
        { method: 'POST', body: JSON.stringify(body) },
      );
      setData(
        (value) =>
          value && {
            ...value,
            recipients: value.recipients.map((item) =>
              item.id === recipient.id ? { ...item, lastSend } : item,
            ),
          },
      );
    } catch (caught) {
      setError(failure(caught, 'Se abrió WhatsApp, pero no se pudo registrar el envío.'));
    }
  }

  return (
    <PageContainer className="msg-page" width="wide">
      <header className="msg-head">
        <h1>Mensajes</h1>
        <p>
          Mensajes de WhatsApp listos para cada situación. Se envían de a uno, desde tu WhatsApp.
        </p>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="msg-layout">
        <SituationNav
          onSelect={(situation) => {
            setSelected(situation);
            setTemplateId(null);
            setFilter('pending');
          }}
          selected={selected}
          situations={situations}
        />
        {summary && current ? (
          <div aria-busy={loading}>
            <SituationPanel
              canManage={can('messages:manage')}
              data={current}
              filter={filter}
              now={new Date()}
              onEdit={setEditing}
              onFilter={setFilter}
              onSend={(recipient, text) => void registerSend(recipient, text)}
              onTemplate={setTemplateId}
              summary={summary}
              template={template}
            />
          </div>
        ) : (
          !error && (
            <p aria-busy="true" role="status">
              Cargando…
            </p>
          )
        )}
      </div>
      {editing !== undefined && summary && (
        <TemplateEditor
          example={current?.recipients[0]?.variables ?? null}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            setEditing(undefined);
            setTemplateId(saved.status === 'ACTIVE' ? saved.id : null);
            void loadRecipients(selected);
          }}
          summary={summary}
          template={editing}
        />
      )}
    </PageContainer>
  );
}
