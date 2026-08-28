import type { PaymentDto, PaymentMethodDto } from '@academy/contracts';
import { describe, expect, it } from 'vitest';
import type { PaymentQuery, PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

const actorId = crypto.randomUUID();
const chargeId = crypto.randomUUID();
const payment = (method: PaymentMethodDto = 'CASH'): PaymentDto => ({
  id: crypto.randomUUID(),
  student: { id: crypto.randomUUID(), dni: '30100001', firstName: 'Ana', lastName: 'Pérez' },
  amount: '40000.00',
  paymentMethod: method,
  status: 'CONFIRMED',
  paidAt: new Date().toISOString(),
  createdBy: { id: actorId, username: 'admision' },
  voidedAt: null,
  voidedBy: null,
  allocations: [
    {
      monthlyChargeId: chargeId,
      amount: '40000.00',
      period: '2026-08',
      dueDate: '2026-08-10',
      academicClass: { id: crypto.randomUUID(), name: 'Bachata' },
      finalAmount: '40000.00',
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
class MemoryPayments implements PaymentsRepository {
  last: { ids: readonly string[]; method: PaymentMethodDto; actorId: string } | null = null;
  item = payment();
  async create(ids: readonly string[], method: PaymentMethodDto, userId: string) {
    this.last = { ids, method, actorId: userId };
    return { ...this.item, paymentMethod: method };
  }
  async findById(id: string) {
    return id === this.item.id ? this.item : null;
  }
  async findPage(query: PaymentQuery) {
    return { items: [this.item], total: 1, page: query.page, pageSize: query.pageSize };
  }
  async void() {
    this.item = {
      ...this.item,
      status: 'VOID',
      voidedAt: new Date().toISOString(),
      voidedBy: { id: actorId, username: 'administracion' },
    };
    return this.item;
  }
}

describe('PaymentsService', () => {
  it('envía cuotas, método y actor autenticado al repositorio', async () => {
    const repository = new MemoryPayments();
    const service = new PaymentsService(repository);
    await service.create({ monthlyChargeIds: [chargeId], paymentMethod: 'CARD' }, actorId);
    expect(repository.last).toEqual({ ids: [chargeId], method: 'CARD', actorId });
  });
  it('rechaza selección vacía y duplicados', async () => {
    const service = new PaymentsService(new MemoryPayments());
    await expect(
      service.create({ monthlyChargeIds: [], paymentMethod: 'CASH' }, actorId),
    ).rejects.toMatchObject({ code: 'PAYMENT_NO_CHARGES' });
    await expect(
      service.create({ monthlyChargeIds: [chargeId, chargeId], paymentMethod: 'CASH' }, actorId),
    ).rejects.toMatchObject({ code: 'PAYMENT_DUPLICATE_CHARGE' });
  });
  it('rechaza un método fuera del contrato', async () => {
    const service = new PaymentsService(new MemoryPayments());
    await expect(
      service.create(
        { monthlyChargeIds: [chargeId], paymentMethod: 'TRANSFER' as PaymentMethodDto },
        actorId,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('conserva el pago anulado en el historial', async () => {
    const repository = new MemoryPayments();
    const service = new PaymentsService(repository);
    await expect(service.void(repository.item.id, actorId)).resolves.toMatchObject({
      status: 'VOID',
      allocations: [{ monthlyChargeId: chargeId }],
    });
    await expect(service.list({ page: 1, pageSize: 25 })).resolves.toMatchObject({
      total: 1,
      items: [{ status: 'VOID' }],
    });
  });
});
