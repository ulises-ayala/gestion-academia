import type { ClosingHandoversDto } from '@academy/contracts';
import React from 'react';
import { dayMonth } from '../lib/dates';
import { money } from '../lib/money';

/**
 * Efectivo de un cierre contra lo entregado a Dirección: lo cobrado en efectivo, lo entregado y la
 * diferencia, con cada entrega que toca el período.
 */
export function ClosingCash({
  handovers,
  onRegister,
}: Readonly<{ handovers: ClosingHandoversDto; onRegister?: (() => void) | undefined }>) {
  const difference = Number(handovers.difference);
  return (
    <section className="closing-cash" aria-labelledby="closing-cash-title">
      <div className="closing-cash-heading">
        <h3 id="closing-cash-title">Efectivo entregado a Dirección</h3>
        {onRegister && (
          <button type="button" className="secondary" onClick={onRegister}>
            Registrar entrega
          </button>
        )}
      </div>
      <dl className="closing-cash-figures">
        <div>
          <dt>Efectivo cobrado</dt>
          <dd>{money(handovers.cash)}</dd>
        </div>
        <div>
          <dt>Entregado</dt>
          <dd>{money(handovers.delivered)}</dd>
        </div>
        <div className={difference < 0 ? 'is-short' : difference > 0 ? 'is-over' : ''}>
          <dt>
            {difference < 0 ? 'Falta entregar' : difference > 0 ? 'Entregado de más' : 'Diferencia'}
          </dt>
          <dd>{money(Math.abs(difference))}</dd>
        </div>
      </dl>
      {handovers.items.length === 0 ? (
        <p className="empty-state">Todavía no hay entregas registradas para este período.</p>
      ) : (
        <ul className="closing-list closing-handovers">
          {handovers.items.map((item) => (
            <li key={item.id}>
              <span>
                <strong>
                  Del {dayMonth(item.fromDate)} al {dayMonth(item.toDate)}
                </strong>
                <small>
                  Recibió {item.receivedBy} · registró {item.createdBy.username}
                  {item.note ? ` · ${item.note}` : ''}
                </small>
              </span>
              <span className="closing-total">{money(item.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
