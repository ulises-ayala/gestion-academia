import type { CashHandoverDto, ClosingHandoversDto } from '@academy/contracts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ClosingCash } from './closing-cash';

const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const handover = (amount: string): CashHandoverDto => ({
  id: amount,
  fromDate: '2026-11-02',
  toDate: '2026-11-07',
  amount,
  collectedAmount: amount,
  difference: '0.00',
  receivedBy: 'Charo',
  note: 'Sobre 1',
  createdBy: { id: 'u', username: 'administracion' },
  createdAt: '2026-11-08T13:00:00.000Z',
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
});
const handovers = (items: readonly CashHandoverDto[], cash: string): ClosingHandoversDto => {
  const delivered = items.reduce((sum, item) => sum + Number(item.amount), 0);
  return {
    items,
    delivered: delivered.toFixed(2),
    cash,
    difference: (delivered - Number(cash)).toFixed(2),
  };
};

describe('efectivo del cierre', () => {
  it('muestra cada entrega y cuánto falta entregar', () => {
    const markup = renderToStaticMarkup(
      <ClosingCash handovers={handovers([handover('800000.00')], '850000.00')} />,
    );
    const shown = text(markup);
    expect(shown).toContain('Efectivo cobrado $ 850.000,00');
    expect(shown).toContain('Entregado $ 800.000,00');
    expect(shown).toContain('Falta entregar $ 50.000,00');
    expect(shown).toContain('Del 02/11 al 07/11 Recibió Charo · registró administracion · Sobre 1');
    expect(markup).toContain('class="is-short"');
    // Sin la acción, es solo consulta.
    expect(markup).not.toContain('Registrar entrega');
  });

  it('sin entregas lo avisa y ofrece registrarla', () => {
    const markup = renderToStaticMarkup(
      <ClosingCash handovers={handovers([], '0.00')} onRegister={() => {}} />,
    );
    expect(text(markup)).toContain('Todavía no hay entregas registradas para este período.');
    expect(text(markup)).toContain('Diferencia $ 0,00');
    expect(markup).toContain('Registrar entrega');
  });
});
