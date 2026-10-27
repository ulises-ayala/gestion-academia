import type { PaymentDto, PaymentMethodDto } from '@academy/contracts';
import { Prisma } from '@academy/database';
import { describe, expect, it } from 'vitest';
import type { PaymentQuery, PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

const actorId = crypto.randomUUID();
const studentId = crypto.randomUUID();
const chargeId = crypto.randomUUID();
const payment = (): PaymentDto => ({
  id: crypto.randomUUID(),
  student: { id: studentId, dni: '30100001', firstName: 'Ana', lastName: 'Pérez' },
  amount: '40000.00',
  tenders: [{ id: crypto.randomUUID(), method: 'CASH', amount: '40000.00' }],
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
      studentDueAmount: '40000.00',
    },
  ],
  kind: 'CHARGES',
  otherConcept: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

class MemoryPayments implements PaymentsRepository {
  last: {
    studentId: string;
    tenders: readonly { method: PaymentMethodDto; amount: string }[];
    actorId: string;
  } | null = null;
  item = payment();
  async create(
    id: string,
    tenders: readonly { method: PaymentMethodDto; amount: string }[],
    userId: string,
  ) {
    this.last = { studentId: id, tenders, actorId: userId };
    return {
      ...this.item,
      amount: tenders
        .reduce((sum, tender) => sum.plus(tender.amount), new Prisma.Decimal(0))
        .toFixed(2),
      tenders: tenders.map((tender) => ({ id: crypto.randomUUID(), ...tender })),
    };
  }
  other: {
    data: { studentId: string; concept: string; classId: string | null; detail: string | null };
    tenders: readonly { method: PaymentMethodDto; amount: string }[];
  } | null = null;
  classStatus: 'ACTIVE' | 'INACTIVE' | null = 'ACTIVE';
  async createOther(
    data: {
      studentId: string;
      concept: 'SINGLE_CLASS' | 'OTHER';
      classId: string | null;
      detail: string | null;
    },
    tenders: readonly { method: PaymentMethodDto; amount: string }[],
  ) {
    this.other = { data, tenders };
    return { ...this.item, allocations: [], kind: 'OTHER' as const, otherConcept: null };
  }
  async findClassStatus() {
    return this.classStatus;
  }
  async findById(id: string) {
    return id === this.item.id ? this.item : null;
  }
  async findPage(query: PaymentQuery) {
    return { items: [this.item], total: 1, page: query.page, pageSize: query.pageSize };
  }
  async confirmedTotal() {
    return this.item.status === 'CONFIRMED' ? this.item.amount : '0.00';
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
  it('normalizes one and multiple tenders and delegates the authenticated actor', async () => {
    const repository = new MemoryPayments();
    const service = new PaymentsService(repository);
    await service.create(
      {
        studentId,
        tenders: [
          { method: 'CASH', amount: '30000' },
          { method: 'MERCADO_PAGO', amount: '10000.5' },
        ],
      },
      actorId,
    );
    expect(repository.last).toEqual({
      studentId,
      actorId,
      tenders: [
        { method: 'CASH', amount: '30000.00' },
        { method: 'MERCADO_PAGO', amount: '10000.50' },
      ],
    });
  });

  it.each([
    [[{ method: 'CASH', amount: '100.00' }], '100.00'],
    [
      [
        { method: 'CASH', amount: '100.00' },
        { method: 'CARD', amount: '50.00' },
      ],
      '150.00',
    ],
    [
      [
        { method: 'CASH', amount: '100.00' },
        { method: 'MERCADO_PAGO', amount: '50.00' },
        { method: 'CARD', amount: '25.00' },
      ],
      '175.00',
    ],
  ] as const)('accepts the confirmed tender combination %#', async (tenders, total) => {
    await expect(
      new PaymentsService(new MemoryPayments()).create({ studentId, tenders }, actorId),
    ).resolves.toMatchObject({ amount: total, tenders });
  });

  it.each([
    [{ studentId, tenders: [] }, 'PAYMENT_NO_TENDERS'],
    [
      {
        studentId,
        tenders: [
          { method: 'CASH', amount: '1' },
          { method: 'CASH', amount: '2' },
        ],
      },
      'PAYMENT_DUPLICATE_TENDER',
    ],
    [{ studentId, tenders: [{ method: 'CASH', amount: '0' }] }, 'VALIDATION_ERROR'],
    [{ studentId, tenders: [{ method: 'CARD', amount: '-1' }] }, 'VALIDATION_ERROR'],
    [{ studentId, tenders: [{ method: 'CARD', amount: '1.999' }] }, 'VALIDATION_ERROR'],
    [
      {
        studentId,
        tenders: [
          { method: 'CASH', amount: '9999999999.99' },
          { method: 'CARD', amount: '1.00' },
        ],
      },
      'VALIDATION_ERROR',
    ],
  ] as const)('rejects invalid tenders', async (input, code) => {
    await expect(
      new PaymentsService(new MemoryPayments()).create(input, actorId),
    ).rejects.toMatchObject({ code });
  });

  it('registra una clase suelta con su clase y normaliza el detalle', async () => {
    const repository = new MemoryPayments();
    const classId = crypto.randomUUID();
    await new PaymentsService(repository).createOther(
      {
        studentId,
        concept: 'SINGLE_CLASS',
        classId,
        detail: '  vino a probar  ',
        tenders: [{ method: 'CASH', amount: '8000' }],
      },
      actorId,
    );
    expect(repository.other).toEqual({
      data: { studentId, concept: 'SINGLE_CLASS', classId, detail: 'vino a probar' },
      tenders: [{ method: 'CASH', amount: '8000.00' }],
    });
  });

  it('“Otro” exige detalle y no guarda clase', async () => {
    const repository = new MemoryPayments();
    const service = new PaymentsService(repository);
    await expect(
      service.createOther(
        { studentId, concept: 'OTHER', detail: ' ', tenders: [{ method: 'CASH', amount: '1' }] },
        actorId,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'detail' } });
    await service.createOther(
      {
        studentId,
        concept: 'OTHER',
        classId: crypto.randomUUID(),
        detail: 'Remera del show',
        tenders: [{ method: 'MERCADO_PAGO', amount: '15000' }],
      },
      actorId,
    );
    expect(repository.other?.data).toMatchObject({ classId: null, detail: 'Remera del show' });
  });

  it('la clase suelta exige una clase existente y activa', async () => {
    const repository = new MemoryPayments();
    const service = new PaymentsService(repository);
    const tenders = [{ method: 'CASH' as const, amount: '8000' }];
    await expect(
      service.createOther({ studentId, concept: 'SINGLE_CLASS', tenders }, actorId),
    ).rejects.toMatchObject({ details: { field: 'classId' } });
    repository.classStatus = 'INACTIVE';
    await expect(
      service.createOther(
        { studentId, concept: 'SINGLE_CLASS', classId: crypto.randomUUID(), tenders },
        actorId,
      ),
    ).rejects.toMatchObject({ code: 'CLASS_INACTIVE' });
    repository.classStatus = null;
    await expect(
      service.createOther(
        { studentId, concept: 'SINGLE_CLASS', classId: crypto.randomUUID(), tenders },
        actorId,
      ),
    ).rejects.toMatchObject({ code: 'CLASS_NOT_FOUND' });
    await expect(
      service.createOther(
        { studentId, concept: 'PROMO' as 'OTHER', detail: 'x', tenders },
        actorId,
      ),
    ).rejects.toMatchObject({ details: { field: 'concept' } });
    expect(repository.other).toBeNull();
  });

  it('rejects an unsupported method', async () => {
    await expect(
      new PaymentsService(new MemoryPayments()).create(
        { studentId, tenders: [{ method: 'TRANSFER' as PaymentMethodDto, amount: '1' }] },
        actorId,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('keeps voided payment tenders and allocations in history', async () => {
    const repository = new MemoryPayments();
    const service = new PaymentsService(repository);
    await expect(
      service.void(repository.item.id, actorId, 'Pago registrado por error'),
    ).resolves.toMatchObject({
      status: 'VOID',
      tenders: [{ method: 'CASH' }],
      allocations: [{ monthlyChargeId: chargeId }],
    });
  });
});
