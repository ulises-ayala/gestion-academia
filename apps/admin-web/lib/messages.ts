import type { MessageSituationSummaryDto } from '@academy/contracts';
import { whatsappNumber } from './whatsapp-receipt';

export type MessagePart = Readonly<{ text: string; filled: boolean }>;

/**
 * El mensaje en partes: el texto fijo y los datos entre llaves ya completados (`filled`), para
 * resaltarlos en la vista previa. Un dato que no vino queda vacío.
 */
export const messageParts = (
  body: string,
  variables: Readonly<Record<string, string>>,
): MessagePart[] =>
  body
    .split(/(\{[^{}\s]+\})/)
    .filter((part) => part !== '')
    .map((part) =>
      /^\{[^{}\s]+\}$/.test(part)
        ? { text: variables[part.slice(1, -1)] ?? '', filled: true }
        : { text: part, filled: false },
    );

/** El mensaje listo para enviar. */
export const renderMessage = (body: string, variables: Readonly<Record<string, string>>) =>
  messageParts(body, variables)
    .map((part) => part.text)
    .join('');

/** Enlace que abre el chat con el texto escrito; null si el teléfono no sirve para WhatsApp. */
export const messageUrl = (phone: string | null, text: string) => {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
};

/** "Hoy", "Ayer" o "Hace 3 días", por día calendario de Buenos Aires. */
export const sentAgo = (sentAt: string, now: Date) => {
  const day = (value: Date) =>
    Date.parse(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Buenos_Aires' }).format(value),
    );
  const days = Math.round((day(now) - day(new Date(sentAt))) / 86_400_000);
  return days <= 0 ? 'Hoy' : days === 1 ? 'Ayer' : `Hace ${days} días`;
};

/** Las situaciones agrupadas (Pagos, Asistencia…) en el orden en que vienen. */
export const situationGroups = (situations: readonly MessageSituationSummaryDto[]) => {
  const groups: { group: string; items: MessageSituationSummaryDto[] }[] = [];
  for (const item of situations) {
    const last = groups.at(-1);
    if (last?.group === item.group) last.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  return groups;
};

/** Inserta `{dato}` donde está el cursor y devuelve el texto y la nueva posición. */
export const insertVariable = (body: string, key: string, start: number, end: number) => {
  const token = `{${key}}`;
  return { body: body.slice(0, start) + token + body.slice(end), cursor: start + token.length };
};
