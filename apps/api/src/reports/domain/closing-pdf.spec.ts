import type { CollectionClosingDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import { renderClosingPdf } from './closing-pdf';

const figures = {
  collections: {
    total: '150000.00',
    byMethod: [
      { method: 'CASH' as const, amount: '100000.00' },
      { method: 'CARD' as const, amount: '50000.00' },
    ],
    byConceptAndMethod: [
      {
        concept: 'CHARGES',
        label: 'Cuotas',
        byMethod: [
          { method: 'CASH' as const, amount: '100000.00' },
          { method: 'CARD' as const, amount: '50000.00' },
        ],
        total: '150000.00',
      },
    ],
  },
  refunds: { total: '0.00', byMethod: [] },
  students: {
    active: 120,
    newStudents: 8,
    dropped: 3,
    pendingCharges: 40,
    pendingDebt: '1600000.00',
    overdueCharges: 12,
    overdueDebt: '480000.00',
  },
};

describe('PDF del cierre', () => {
  it('genera el PDF con la foto, los alumnos y las correcciones', async () => {
    const closing: CollectionClosingDto = {
      id: 'c',
      kind: 'MONTHLY',
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
      total: '150000.00',
      createdBy: { id: 'u', username: 'administracion' },
      createdAt: '2026-11-01T13:00:00.000Z',
      snapshot: figures,
      current: { ...figures, students: null },
      changes: [
        {
          concept: 'CHARGES',
          label: 'Cuotas',
          method: 'CASH',
          original: '100000.00',
          current: '60000.00',
          difference: '-40000.00',
        },
      ],
      sequence: null,
      handovers: {
        items: [
          {
            id: 'h',
            fromDate: '2026-10-01',
            toDate: '2026-10-31',
            amount: '90000.00',
            collectedAmount: '100000.00',
            difference: '-10000.00',
            receivedBy: 'Dirección',
            note: 'Sobre de octubre',
            createdBy: { id: 'u', username: 'administracion' },
            createdAt: '2026-11-01T13:00:00.000Z',
            voidedAt: null,
            voidedBy: null,
            voidReason: null,
          },
        ],
        delivered: '90000.00',
        cash: '100000.00',
        difference: '-10000.00',
      },
    };
    const file = await renderClosingPdf(closing, 'America/Buenos_Aires');
    expect(file.subarray(0, 4).toString()).toBe('%PDF');
    // Semanal, con su número de corte y sin entregas registradas.
    const weekly = await renderClosingPdf(
      {
        ...closing,
        kind: 'WEEKLY',
        sequence: 1,
        handovers: { items: [], delivered: '0.00', cash: '100000.00', difference: '-100000.00' },
      },
      'America/Buenos_Aires',
    );
    expect(weekly.subarray(0, 4).toString()).toBe('%PDF');
  });
});
