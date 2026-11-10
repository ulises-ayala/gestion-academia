import { describe, expect, it } from 'vitest';
import {
  insertVariable,
  messageParts,
  messageUrl,
  renderMessage,
  sentAgo,
  situationGroups,
} from './messages';

describe('mensajes de WhatsApp', () => {
  const variables = { nombre: 'Ana', saldo_vencido: '$ 80.000,00' };

  it('completa los datos entre llaves y conserva emojis y negrita', () => {
    expect(renderMessage('Hola {nombre} 👋 de *Carmesí*: debés {saldo_vencido}.', variables)).toBe(
      'Hola Ana 👋 de *Carmesí*: debés $ 80.000,00.',
    );
    expect(renderMessage('Hola {nombre}, {clase}', variables)).toBe('Hola Ana, ');
  });

  it('separa lo completado para resaltarlo', () => {
    expect(messageParts('Hola {nombre} 💃', variables)).toEqual([
      { text: 'Hola ', filled: false },
      { text: 'Ana', filled: true },
      { text: ' 💃', filled: false },
    ]);
  });

  it('arma el enlace de WhatsApp o avisa que el teléfono no sirve', () => {
    expect(messageUrl('370 503-2792', 'Hola Ana 👋')).toBe(
      `https://wa.me/5493705032792?text=${encodeURIComponent('Hola Ana 👋')}`,
    );
    expect(messageUrl(null, 'Hola')).toBeNull();
    expect(messageUrl('503', 'Hola')).toBeNull();
  });

  it('dice hace cuánto se envió, por día de Buenos Aires', () => {
    const now = new Date('2026-11-10T15:00:00.000Z');
    expect(sentAgo('2026-11-10T12:00:00.000Z', now)).toBe('Hoy');
    // 23:30 del 9 en Buenos Aires.
    expect(sentAgo('2026-11-10T02:30:00.000Z', now)).toBe('Ayer');
    expect(sentAgo('2026-11-07T15:00:00.000Z', now)).toBe('Hace 3 días');
  });

  it('agrupa las situaciones respetando el orden', () => {
    const item = (situation: string, group: string) =>
      ({ situation, group, label: situation, description: '', variables: [], count: 0 }) as never;
    expect(
      situationGroups([item('A', 'Pagos'), item('B', 'Pagos'), item('C', 'Asistencia')]).map(
        (group) => [group.group, group.items.length],
      ),
    ).toEqual([
      ['Pagos', 2],
      ['Asistencia', 1],
    ]);
  });

  it('inserta un dato en la posición del cursor', () => {
    expect(insertVariable('Hola !', 'nombre', 5, 5)).toEqual({
      body: 'Hola {nombre}!',
      cursor: 13,
    });
  });
});
