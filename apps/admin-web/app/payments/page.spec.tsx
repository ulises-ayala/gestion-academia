import type { PaymentDto } from '@academy/contracts';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PaymentHistory } from '../../components/payment-history';

const payment: PaymentDto = {
  id: 'payment-id',
  student: { id: 'student-id', dni: '30100100', firstName: 'Ana', lastName: 'Pérez' },
  amount: '50000.00',
  tenders: [
    { id: 'cash-id', method: 'CASH', amount: '30000.00' },
    { id: 'mp-id', method: 'MERCADO_PAGO', amount: '20000.00' },
  ],
  status: 'CONFIRMED',
  paidAt: '2026-08-31T15:00:00.000Z',
  createdBy: { id: 'user-id', username: 'admision' },
  voidedAt: null,
  voidedBy: null,
  allocations: [
    {
      monthlyChargeId: 'charge-id',
      amount: '50000.00',
      period: '2026-08',
      dueDate: '2026-08-10',
      academicClass: { id: 'class-id', name: 'Bachata' },
      finalAmount: '80000.00',
      studentDueAmount: '80000.00',
    },
  ],
  createdAt: '2026-08-31T15:00:00.000Z',
  updatedAt: '2026-08-31T15:00:00.000Z',
};

describe('PaymentHistory', () => {
  it('renders the global student context and a legible mixed payment breakdown', () => {
    const markup = renderToStaticMarkup(
      <PaymentHistory
        canVoid={false}
        payments={[payment]}
        showStudent
        studentHref={(id) => `/payments?tab=history&studentId=${id}`}
        onVoid={() => undefined}
      />,
    );
    expect(markup).toContain('Ana Pérez');
    expect(markup).toContain('DNI 30100100');
    expect(markup).toContain('Efectivo');
    expect(markup).toContain('Mercado Pago');
    expect(markup).toContain('Bachata 2026-08');
    expect(markup).toContain('studentId=student-id');
    expect(markup).not.toContain('Anular</button>');
  });

  it('shows VOID only to an authorized user and only for confirmed payments', () => {
    const confirmed = renderToStaticMarkup(
      <PaymentHistory canVoid payments={[payment]} onVoid={() => undefined} />,
    );
    const voided = renderToStaticMarkup(
      <PaymentHistory
        canVoid
        payments={[{ ...payment, status: 'VOID' }]}
        onVoid={() => undefined}
      />,
    );
    expect(confirmed).toContain('Anular</button>');
    expect(voided).toContain('Anulado');
    expect(voided).not.toContain('Anular</button>');
  });
});

describe('Payments center markup', () => {
  const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  it('separa los filtros de la tabla y no corta estados o acciones', () => {
    expect(styles).toMatch(/\.payment-history-filters[\s\S]*margin-bottom: var\(--space-4\)/);
    expect(styles).toMatch(/\.status,[\s\S]*white-space: nowrap/);
    expect(styles).toMatch(/td button\.secondary[\s\S]*white-space: nowrap/);
  });

  it('limpia los campos locales y oculta la acción cuando no hay filtros activos', () => {
    expect(page).toContain('const clearAccountFilters = () =>');
    expect(page).toContain("setAccountQ('')");
    expect(page).toContain("setAccountSort('oldest')");
    expect(page).toContain('{hasAccountFilters && (');
    expect(page).toContain('onClick={clearHistoryFilters}');
    expect(page.indexOf('className="payment-account-filters"')).toBeLessThan(
      page.indexOf('className="context-filter payment-context-chip"'),
    );
    expect(styles).toMatch(/\.payment-context-chip[\s\S]*margin: 0 0 var\(--space-4\)/);
  });

  it('ofrece abrir Caja preservando el contexto del cobro', () => {
    expect(page).toContain('cashHrefForPayment(locationSearch)');
    expect(page).toContain('Abrir caja');
  });

  it('loads debtors without selecting a student and exposes the operational controls', () => {
    expect(page).toContain("!location.studentId && location.tab === 'accounts'");
    expect(page).toContain('Total por cobrar');
    expect(page).toContain('Cuotas con saldo');
    expect(page).toContain('Alumnos con deuda');
    expect(page).toContain('Todas con saldo');
    expect(page).toContain('Vencidas');
    expect(page).toContain('Parciales');
    expect(page).toContain('Sin pagos');
    expect(page).toContain('Ver cuenta');
    expect(page).toContain('Cobrar');
  });

  it('keeps contextual loading, empty and retry states', () => {
    expect(page).toContain('Cargando cuentas pendientes…');
    expect(page).toContain('Cargando cuotas vencidas…');
    expect(page).toContain('Cargando historial de cobros…');
    expect(page).toContain('No hay cuentas pendientes.');
    expect(page).toContain('No hay cuotas vencidas.');
    expect(page).toContain('No hay cuotas parcialmente abonadas.');
    expect(page).toContain('No hay cobros registrados con estos filtros.');
    expect(page).toContain('Reintentar');
  });

  it('defines card-based responsive layouts for tablet and narrow mobile', () => {
    expect(styles).toContain('@media (max-width: 720px)');
    expect(styles).toContain('@media (max-width: 390px)');
    expect(styles).toContain('.receivables-card .debtor-row');
    expect(styles).toContain('.account-metrics');
    expect(styles).toContain('grid-template-columns: 1fr;');
  });
});
