'use client';

import type {
  MessageSituationSummaryDto,
  MessageTemplateDto,
  SaveMessageTemplateDto,
} from '@academy/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiClientError, apiRequest } from '../../lib/api-client';
import { insertVariable } from '../../lib/messages';
import { Button } from '../ui/button';
import { MessageBubble } from './messages-view';

/**
 * Crea o edita un mensaje predeterminado: texto libre con emojis, botones para insertar los datos
 * de la situación y la vista previa al lado. También lo da de baja.
 */
export function TemplateEditor({
  summary,
  template,
  example,
  onClose,
  onSaved,
}: Readonly<{
  summary: MessageSituationSummaryDto;
  /** null = mensaje nuevo. */
  template: MessageTemplateDto | null;
  /** Datos de una persona real de la lista para la vista previa. */
  example: Readonly<Record<string, string>> | null;
  onClose(): void;
  onSaved(template: MessageTemplateDto): void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState(template?.name ?? '');
  const [body, setBody] = useState(template?.body ?? 'Hola {nombre} 👋\n');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      opener?.focus();
    };
  }, []);

  async function save(payload: SaveMessageTemplateDto) {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      onSaved(
        await apiRequest<MessageTemplateDto>(
          template ? `/messages/templates/${template.id}` : '/messages/templates',
          { method: template ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'No se pudo guardar el mensaje.',
      );
      setSaving(false);
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save({ situation: summary.situation, name, body });
  };
  const insert = (key: string) => {
    const field = textarea.current;
    const next = insertVariable(
      body,
      key,
      field?.selectionStart ?? body.length,
      field?.selectionEnd ?? body.length,
    );
    setBody(next.body);
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(next.cursor, next.cursor);
    });
  };
  const variables =
    example ?? Object.fromEntries(summary.variables.map((item) => [item.key, `{${item.key}}`]));

  return (
    <dialog
      aria-labelledby="template-editor-title"
      className="modal card msg-editor-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      ref={dialog}
    >
      <form className="msg-editor" onSubmit={submit}>
        <div className="msg-editor-fields">
          <h2 id="template-editor-title">
            {template ? 'Editar mensaje' : 'Nuevo mensaje'} · {summary.label}
          </h2>
          <label>
            Nombre
            <input
              disabled={saving}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="Recordatorio amable"
              required
              value={name}
            />
          </label>
          <label>
            Mensaje
            <textarea
              disabled={saving}
              maxLength={2000}
              onChange={(event) => setBody(event.target.value)}
              ref={textarea}
              required
              rows={9}
              value={body}
            />
          </label>
          <div className="msg-chips" aria-label="Insertar un dato">
            {summary.variables.map((item) => (
              <button
                className="msg-chip"
                disabled={saving}
                key={item.key}
                onClick={() => insert(item.key)}
                type="button"
              >
                + {item.label}
              </button>
            ))}
          </div>
          <p className="msg-note">
            Los emojis se escriben como en cualquier chat (en Windows, tecla Windows + punto). Para
            negrita, poné el texto entre *asteriscos*.
          </p>
        </div>
        <div>
          <p className="msg-note">Vista previa</p>
          <MessageBubble body={body} variables={variables} />
        </div>
        {error && (
          <p className="error msg-editor-wide" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions msg-editor-wide">
          {template && (
            <Button
              disabled={saving}
              onClick={() => void save({ status: 'INACTIVE' })}
              type="button"
              variant="destructive"
            >
              Dar de baja
            </Button>
          )}
          <Button disabled={saving} onClick={onClose} type="button" variant="secondary">
            Cancelar
          </Button>
          <Button disabled={saving || !name.trim() || !body.trim()} loading={saving} type="submit">
            {saving ? 'Guardando…' : 'Guardar mensaje'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
