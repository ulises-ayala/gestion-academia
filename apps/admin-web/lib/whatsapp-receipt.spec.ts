import type { PaymentDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import { receiptText, whatsappNumber, whatsappReceiptUrl } from './whatsapp-receipt';

const payment = (overrides: Partial<PaymentDto> = {}) =>
  ({
    id: '7f3a9c21-0000-4000-8000-000000000000',
    student: { id: 's1', dni: '40123456', firstName: 'Lucía', lastName: 'Gómez' },
    amount: '40000.00',
    tenders: [{ id: 't1', method: 'CASH', amount: '40000.00' }],
    status: 'CONFIRMED',
    paidAt: '2026-11-01T14:30:00.000Z',
    kind: 'CHARGES',
    otherConcept: null,
    allocations: [
      {
        monthlyChargeId: 'c1',
        amount: '40000.00',
        kind: 'MONTHLY',
        description: null,
        period: '2026-11',
        dueDate: '2026-11-10',
        academicClass: { id: 'k1', name: 'Formación Docente' },
        finalAmount: '40000.00',
        studentDueAmount: '40000.00',
      },
    ],
    ...overrides,
  }) as PaymentDto;

describe('recibo por WhatsApp', () => {
  it('lleva el teléfono argentino al formato de WhatsApp', () => {
    expect(whatsappNumber('3705032792')).toBe('5493705032792');
    expect(whatsappNumber('0370 15 503-2792')).toBe('5493705032792');
    expect(whatsappNumber('370155032792')).toBe('5493705032792');
    expect(whatsappNumber('+54 9 370 503 2792')).toBe('5493705032792');
    expect(whatsappNumber('+54 370 503 2792')).toBe('5493705032792');
    expect(whatsappNumber('011 15 1234-5678')).toBe('5491112345678');
    expect(whatsappNumber('503-2792')).toBeNull();
    expect(whatsappNumber(null)).toBeNull();
  });

  it('arma el recibo con el detalle, el total, el saldo y el contacto de la academia', () => {
    const text = receiptText(payment(), '25000.00');
    expect(text).toContain('*Carmesí* · Comprobante de pago');
    expect(text).toContain('Lucía Gómez (DNI 40123456)');
    expect(text).toMatch(/• Formación Docente · Noviembre de 2026: \$\s?40\.000,00/);
    expect(text).toMatch(/Medio de pago: Efectivo \$\s?40\.000,00/);
    expect(text).toMatch(/Saldo pendiente: \$\s?25\.000,00/);
    expect(text).toContain('Comprobante N.º 7F3A9C21');
    expect(text).toContain('Consultas: 370 508-4498');
    expect(receiptText(payment(), '0.00')).toContain('Cuenta al día.');
    expect(receiptText(payment())).not.toMatch(/Saldo|al día/);
  });

  it('abre el chat del alumno o, sin teléfono válido, deja elegir el contacto', () => {
    expect(whatsappReceiptUrl(payment(), '3705032792')).toMatch(
      /^https:\/\/wa\.me\/5493705032792\?text=\*Carmes%C3%AD\*/,
    );
    expect(whatsappReceiptUrl(payment(), '')).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });
});
