import type {
  MessageRecipientDto,
  MessageRecipientsDto,
  MessageSituationDto,
  MessageSituationSummaryDto,
  MessageTemplateDto,
} from '@academy/contracts';
import Link from 'next/link';
import React from 'react';
import {
  messageParts,
  messageUrl,
  renderMessage,
  sentAgo,
  situationGroups,
} from '../../lib/messages';

/** Vista previa de un mensaje como burbuja de WhatsApp, con los datos completados resaltados. */
export function MessageBubble({
  body,
  variables,
}: Readonly<{ body: string; variables: Readonly<Record<string, string>> }>) {
  return (
    <p className="msg-bubble">
      {messageParts(body, variables).map((part, index) =>
        part.filled ? <mark key={index}>{part.text}</mark> : part.text,
      )}
    </p>
  );
}

export function SituationNav({
  situations,
  selected,
  onSelect,
}: Readonly<{
  situations: readonly MessageSituationSummaryDto[];
  selected: MessageSituationDto;
  onSelect(situation: MessageSituationDto): void;
}>) {
  return (
    <nav aria-label="Situaciones" className="msg-situations">
      {situationGroups(situations).map((group) => (
        <React.Fragment key={group.group}>
          <h2>{group.group}</h2>
          {group.items.map((item) => (
            <button
              aria-current={item.situation === selected ? 'true' : undefined}
              className="msg-situation"
              key={item.situation}
              onClick={() => onSelect(item.situation)}
              type="button"
            >
              {item.label}
              <span className="msg-count">{item.count}</span>
            </button>
          ))}
        </React.Fragment>
      ))}
    </nav>
  );
}

export type RecipientFilter = 'pending' | 'sent';

export function SituationPanel({
  summary,
  data,
  template,
  canManage,
  filter,
  now,
  onTemplate,
  onEdit,
  onFilter,
  onSend,
}: Readonly<{
  summary: MessageSituationSummaryDto;
  data: MessageRecipientsDto;
  /** El mensaje elegido; null si la situación no tiene ninguno. */
  template: MessageTemplateDto | null;
  canManage: boolean;
  filter: RecipientFilter;
  now: Date;
  onTemplate(id: string): void;
  /** Abre el editor: con un mensaje para cambiarlo, con null para crear uno. */
  onEdit(template: MessageTemplateDto | null): void;
  onFilter(filter: RecipientFilter): void;
  onSend(recipient: MessageRecipientDto, text: string): void;
}>) {
  const pending = data.recipients.filter((item) => !item.lastSend);
  const sent = data.recipients.filter((item) => item.lastSend);
  const shown = filter === 'pending' ? pending : sent;
  const example = data.recipients[0];
  const people = summary.group === 'Potenciales' ? 'potenciales' : 'alumnos';
  return (
    <div className="msg-main">
      <section className="msg-card">
        <div className="msg-card-head">
          <div>
            <h2>{summary.label}</h2>
            <p>{summary.description}</p>
          </div>
          <div className="msg-chips">
            {data.templates.map((item) => (
              <button
                aria-pressed={item.id === template?.id}
                className="msg-chip"
                key={item.id}
                onClick={() => onTemplate(item.id)}
                type="button"
              >
                {item.name}
              </button>
            ))}
            {canManage && template && (
              <button className="secondary" onClick={() => onEdit(template)} type="button">
                Editar mensaje
              </button>
            )}
            {canManage && (
              <button className="secondary" onClick={() => onEdit(null)} type="button">
                Nuevo mensaje
              </button>
            )}
          </div>
        </div>
        {template ? (
          <div className="msg-template">
            <MessageBubble
              body={template.body}
              variables={
                example?.variables ??
                Object.fromEntries(summary.variables.map((item) => [item.key, `{${item.key}}`]))
              }
            />
            <div className="msg-side">
              {example ? (
                <p>
                  Así le llega a <strong>{example.name}</strong>. Lo resaltado se completa solo con
                  los datos de cada persona.
                </p>
              ) : (
                <p>Hoy no hay nadie en esta situación; el mensaje queda listo para cuando haya.</p>
              )}
              <p>Datos disponibles: {summary.variables.map((item) => item.label).join(', ')}.</p>
              <p className="msg-note">Antes de enviar lo ves en WhatsApp y lo podés retocar.</p>
            </div>
          </div>
        ) : (
          <p className="empty-state">
            Esta situación todavía no tiene un mensaje.
            {canManage
              ? ' Creá uno con "Nuevo mensaje".'
              : ' Pedile a Administración que cree uno.'}
          </p>
        )}
      </section>

      <section className="msg-card">
        <div className="msg-card-head">
          <div>
            <h2>
              {data.recipients.length} {data.recipients.length === 1 ? people.slice(0, -1) : people}
            </h2>
            <p>Un aviso cuenta como enviado durante 30 días.</p>
          </div>
          <div className="msg-chips">
            <button
              aria-pressed={filter === 'pending'}
              className="msg-chip"
              onClick={() => onFilter('pending')}
              type="button"
            >
              Sin avisar · {pending.length}
            </button>
            <button
              aria-pressed={filter === 'sent'}
              className="msg-chip"
              onClick={() => onFilter('sent')}
              type="button"
            >
              Avisados · {sent.length}
            </button>
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="empty-state">
            {data.recipients.length === 0
              ? 'Hoy no hay nadie en esta situación.'
              : filter === 'pending'
                ? 'Ya les escribiste a todos. 🎉'
                : 'Todavía no le escribiste a nadie de esta lista.'}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="msg-table">
              <thead>
                <tr>
                  <th scope="col">{summary.group === 'Potenciales' ? 'Potencial' : 'Alumno'}</th>
                  <th scope="col">Situación</th>
                  <th scope="col">Último aviso</th>
                  <th scope="col">
                    <span className="sr-only">Enviar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => {
                  const href =
                    item.kind === 'STUDENT' ? `/students/${item.id}` : `/leads/${item.id}`;
                  const text = template ? renderMessage(template.body, item.variables) : '';
                  const url = template ? messageUrl(item.phone, text) : null;
                  return (
                    <tr key={item.id}>
                      <td data-label={summary.group === 'Potenciales' ? 'Potencial' : 'Alumno'}>
                        <Link className="text-link" href={href}>
                          {item.name}
                        </Link>
                        {url || !template ? (
                          <small>{item.phone ?? 'Sin teléfono cargado'}</small>
                        ) : (
                          <small className="msg-nophone">
                            {item.phone
                              ? `${item.phone} · no sirve para WhatsApp`
                              : 'Sin teléfono cargado'}
                          </small>
                        )}
                      </td>
                      <td data-label="Situación">{item.detail}</td>
                      <td className="msg-sent" data-label="Último aviso">
                        {item.lastSend ? (
                          <>
                            {sentAgo(item.lastSend.sentAt, now)} · {item.lastSend.sentBy}
                            {item.lastSend.templateName && (
                              <small>{item.lastSend.templateName}</small>
                            )}
                          </>
                        ) : (
                          'Nunca'
                        )}
                      </td>
                      <td className="msg-action" data-label="WhatsApp">
                        {url ? (
                          <a
                            className={`msg-send${item.lastSend ? ' is-again' : ''}`}
                            href={url}
                            onClick={() => onSend(item, text)}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {item.lastSend ? 'Volver a enviar' : 'Enviar por WhatsApp'}
                          </a>
                        ) : template ? (
                          <Link className="button secondary" href={href}>
                            Cargar teléfono
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
