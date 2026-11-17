import { describe, expect, it } from 'vitest';
import {
  closingCutLabel,
  closingPayload,
  closingPeriodLabel,
  closingPreviewQuery,
  closingSummaryText,
  closingSummaryUrl,
  type ClosingSummaryInput,
} from './closings';

const methods = (cash: string, mp: string, card: string) => [
  { method: 'CASH' as const, amount: cash },
  { method: 'MERCADO_PAGO' as const, amount: mp },
  { method: 'TRANSFER' as const, amount: '0.00' },
  { method: 'CARD' as const, amount: card },
];
const row = (concept: string, label: string, total: string) => ({
  concept,
  label,
  byMethod: methods('0.00', total, '0.00'),
  total,
});
// El corte que la PO le rindió a Dirección a mano (02 al 07/11/2026).
const week: ClosingSummaryInput = {
  kind: 'WEEKLY',
  fromDate: '2026-11-02',
  toDate: '2026-11-07',
  sequence: 1,
  figures: {
    collections: {
      total: '4301184.04',
      byMethod: methods('850000.00', '3409500.00', '41684.04'),
      byConceptAndMethod: [
        row('CHARGES', 'Cuotas', '1878684.04'),
        row('TRAINING', 'Formaciones', '45000.00'),
        row('entradas', 'Precintos / entradas', '2330500.00'),
        row('indumentaria', 'Indumentaria', '22000.00'),
        row('otros', 'Otros', '25000.00'),
      ],
    },
    refunds: { total: '0.00', byMethod: methods('0.00', '0.00', '0.00') },
    students: null,
  },
  handovers: {
    items: [
      {
        id: 'h',
        fromDate: '2026-11-02',
        toDate: '2026-11-07',
        amount: '850000.00',
        collectedAmount: '850000.00',
        difference: '0.00',
        receivedBy: 'Dirección',
        note: null,
        createdBy: { id: 'u', username: 'administracion' },
        createdAt: '2026-11-08T13:00:00.000Z',
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
      },
    ],
    delivered: '850000.00',
    cash: '850000.00',
    difference: '0.00',
  },
};

describe('cierres', () => {
  it('nombra el período como lo lee la academia', () => {
    expect(closingPeriodLabel('WEEKLY', '2026-11-02', '2026-11-08')).toBe(
      'Del 02/11/2026 al 08/11/2026',
    );
    expect(closingPeriodLabel('MONTHLY', '2026-10-01', '2026-10-31')).toBe('Octubre de 2026');
  });

  it('arma el pedido y la vista previa según el tipo de cierre', () => {
    const week = { fromDate: '2026-11-02', toDate: '2026-11-08' };
    expect(closingPayload('WEEKLY', week)).toEqual({ kind: 'WEEKLY', ...week });
    expect(closingPayload('MONTHLY', { fromDate: '2026-10-01', toDate: '2026-10-31' })).toEqual({
      kind: 'MONTHLY',
      month: '2026-10',
    });
    expect(closingPreviewQuery('WEEKLY', week)).toBe('kind=WEEKLY&from=2026-11-02&to=2026-11-08');
    expect(closingPreviewQuery('MONTHLY', null)).toBe('kind=MONTHLY');
  });
});

describe('resumen del cierre para Dirección', () => {
  it('arma el mismo informe que se rendía a mano', () => {
    expect(closingCutLabel('2026-11-02', 1)).toBe('1.º corte de noviembre');
    expect(closingCutLabel('2026-10-01', null)).toBeNull();
    expect(closingSummaryText(week)).toBe(
      [
        '*CARMESÍ – RESUMEN DE INGRESOS*',
        '*Período: 02/11 al 07/11/2026*',
        '1.º CORTE – NOVIEMBRE',
        '',
        'INGRESOS POR CONCEPTO',
        '• Cuotas: $1.878.684,04',
        '• Formaciones: $45.000',
        '• Precintos / entradas: $2.330.500',
        '• Indumentaria: $22.000',
        '• Otros: $25.000',
        '',
        'INGRESOS POR MEDIO DE PAGO',
        '• Efectivo: $850.000',
        '• Mercado Pago: $3.409.500',
        '• Tarjeta: $41.684,04',
        '',
        '*TOTAL RECAUDADO: $4.301.184,04*',
        '',
        'EFECTIVO ENTREGADO',
        '• Del 02/11 al 07/11: $850.000 (recibió Dirección)',
        '',
        'Movimientos registrados del 02/11/2026 al 07/11/2026.',
      ].join('\n'),
    );
  });

  it('avisa lo que falta entregar, las devoluciones y sirve para el mes', () => {
    const month = closingSummaryText({
      ...week,
      kind: 'MONTHLY',
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
      sequence: null,
      figures: {
        ...week.figures,
        refunds: { total: '5000.00', byMethod: methods('5000.00', '0.00', '0.00') },
      },
      handovers: { ...week.handovers, cash: '845000.00', difference: '5000.00' },
    });
    expect(month).toContain('*Período: Noviembre de 2026*\nCIERRE MENSUAL');
    expect(month).toContain('Devoluciones de saldo a favor: $5.000');
    expect(month).toContain('Entregado de más: $5.000');
    const pending = closingSummaryText({
      ...week,
      handovers: { items: [], delivered: '0.00', cash: '850000.00', difference: '-850000.00' },
    });
    expect(pending).not.toContain('EFECTIVO ENTREGADO');
    expect(closingSummaryUrl('Total: $1')).toBe('https://wa.me/?text=Total%3A%20%241');
  });
});
