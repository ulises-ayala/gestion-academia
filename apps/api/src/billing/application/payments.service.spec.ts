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
  correctionOfId: null,
  correctedById: null,
  voidedAt: null,
  voidedBy: null,
  allocations: [
    {
      monthlyChargeId: chargeId,
      amount: '40000.00',
      kind: 'MONTHLY',
      description: null,
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
  lastPaidAt: Date | undefined = undefined;
  async create(
    id: string,
    tenders: readonly { method: PaymentMethodDto; amount: string }[],
    userId: string,
    paidAt?: Date,
  ) {
    this.last = { studentId: id, tenders, actorId: userId };
    this.lastPaidAt = paidAt;
    return {
      ...this.item,
      amount: tenders
        .reduce((sum, tender) => sum.plus(tender.amount), new Prisma.Decimal(0))
        .toFixed(2),
      tenders: tenders.map((tender) => ({ id: crypto.randomUUID(), ...tender })),
    };
  }
  other: {
    data: {
      studentId: string;
      concept: string;
      classId: string | null;
      teacherId: string | null;
      detail: string | null;
    };
    tenders: readonly { method: PaymentMethodDto; amount: string }[];
  } | null = null;
  classStatus: 'ACTIVE' | 'INACTIVE' | null = 'ACTIVE';
  classTeacherId = 'teacher-of-class';
  teacherStatus: 'ACTIVE' | 'INACTIVE' | null = 'ACTIVE';
  async createOther(
    data: {
      studentId: string;
      concept: 'SINGLE_CLASS' | 'OTHER';
      classId: string | null;
      teacherId: string | null;
      detail: string | null;
    },
    tenders: readonly { method: PaymentMethodDto; amount: string }[],
  ) {
    this.other = { data, tenders };
    return { ...this.item, allocations: [], kind: 'OTHER' as const, otherConcept: null };
  }
  async findClass() {
    return this.classStatus ? { status: this.classStatus, teacherId: this.classTeacherId } : null;
  }
  async findTeacherStatus() {
    return this.teacherStatus;
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
  corrected: {
    id: string;
    input: { tenders: readonly { method: PaymentMethodDto; amount: string }[]; paidAt: Date };
    reason: string;
  } | null = null;
  async correct(
    id: string,
    input: { tenders: readonly { method: PaymentMethodDto; amount: string }[]; paidAt: Date },
    _actorId: string,
    reason: string,
  ) {
    this.corrected = { id, input, reason };
    return { ...this.item, id: crypto.randomUUID(), correctionOfId: id };
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
      data: {
        studentId,
        concept: 'SINGLE_CLASS',
        classId,
        teacherId: 'teacher-of-class',
        detail: 'vino a probar',
      },
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
    expect(repository.other?.data).toMatchObject({
      classId: null,
      teacherId: null,
      detail: 'Remera del show',
    });
  });

  it('la clase suelta queda con el profesor que la dictó: el de la clase o un reemplazo activo', async () => {
    const repository = new MemoryPayments();
    const service = new PaymentsService(repository);
    const classId = crypto.randomUUID();
    const substitute = crypto.randomUUID();
    const tenders = [{ method: 'CASH' as const, amount: '8000' }];
    await service.createOther(
      { studentId, concept: 'SINGLE_CLASS', classId, teacherId: substitute, tenders },
      actorId,
    );
    expect(repository.other?.data.teacherId).toBe(substitute);
    repository.teacherStatus = 'INACTIVE';
    await expect(
      service.createOther(
        { studentId, concept: 'SINGLE_CLASS', classId, teacherId: crypto.randomUUID(), tenders },
        actorId,
      ),
    ).rejects.toMatchObject({ code: 'TEACHER_INACTIVE' });
    repository.teacherStatus = null;
    await expect(
      service.createOther(
        { studentId, concept: 'SINGLE_CLASS', classId, teacherId: crypto.randomUUID(), tenders },
        actorId,
      ),
    ).rejects.toMatchObject({ code: 'TEACHER_NOT_FOUND' });
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

  describe('corregir pago', () => {
    // 01/11/2026 22:00 en Argentina.
    const now = new Date('2026-11-02T01:00:00.000Z');
    const setup = () => {
      const repository = new MemoryPayments();
      repository.item = { ...payment(), paidAt: '2026-10-30T14:00:00.000Z' };
      return { repository, service: new PaymentsService(repository) };
    };

    it('cambia el medio de pago con motivo y conserva la fecha', async () => {
      const { repository, service } = setup();
      await service.correct(
        repository.item.id,
        {
          reason: 'Era Mercado Pago, se cargó como efectivo',
          tenders: [{ method: 'MERCADO_PAGO', amount: '40000' }],
        },
        actorId,
        now,
      );
      expect(repository.corrected).toEqual({
        id: repository.item.id,
        input: {
          tenders: [{ method: 'MERCADO_PAGO', amount: '40000.00' }],
          paidAt: new Date('2026-10-30T14:00:00.000Z'),
        },
        reason: 'Era Mercado Pago, se cargó como efectivo',
      });
    });

    it('corrige la fecha real del pago al mediodía de ese día', async () => {
      const { repository, service } = setup();
      await service.correct(
        repository.item.id,
        {
          reason: 'Pagó el 15/10, se cargó tarde',
          tenders: [{ method: 'CASH', amount: '40000' }],
          paidDate: '2026-10-15',
        },
        actorId,
        now,
      );
      expect(repository.corrected?.input.paidAt).toEqual(new Date('2026-10-15T15:00:00.000Z'));
    });

    it('rechaza sin motivo, sin cambios, con fecha futura o sobre un pago anulado', async () => {
      const { repository, service } = setup();
      const id = repository.item.id;
      const same = [{ method: 'CASH' as const, amount: '40000' }];
      await expect(
        service.correct(id, { reason: ' ', tenders: same }, actorId, now),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'reason' } });
      await expect(
        service.correct(id, { reason: 'x', tenders: same, paidDate: '2026-10-30' }, actorId, now),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'No hay cambios para corregir',
      });
      await expect(
        service.correct(id, { reason: 'x', tenders: same, paidDate: '2026-11-02' }, actorId, now),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'paidDate' } });
      repository.item = { ...repository.item, status: 'VOID' };
      await expect(
        service.correct(
          id,
          { reason: 'x', tenders: [{ method: 'CARD', amount: '1' }] },
          actorId,
          now,
        ),
      ).rejects.toMatchObject({ code: 'PAYMENT_ALREADY_VOID' });
      expect(repository.corrected).toBeNull();
    });
  });

  describe('pago cargado tarde con su fecha real', () => {
    const now = new Date('2026-11-02T01:00:00.000Z'); // 01/11 22:00 en Argentina
    const tenders = [{ method: 'CASH' as const, amount: '40000' }];

    it('Administración lo carga con la fecha en que se pagó', async () => {
      const repository = new MemoryPayments();
      await new PaymentsService(repository).create(
        { studentId, tenders, paidDate: '2026-10-05' },
        actorId,
        true,
        now,
      );
      expect(repository.lastPaidAt).toEqual(new Date('2026-10-05T15:00:00.000Z'));
    });

    it('con la fecha de hoy queda la hora de carga', async () => {
      const repository = new MemoryPayments();
      await new PaymentsService(repository).create(
        { studentId, tenders, paidDate: '2026-11-01' },
        actorId,
        true,
        now,
      );
      expect(repository.lastPaidAt).toBeUndefined();
    });

    it('Admisión no puede cambiar la fecha', async () => {
      const repository = new MemoryPayments();
      await expect(
        new PaymentsService(repository).create(
          { studentId, tenders, paidDate: '2026-10-05' },
          actorId,
          false,
          now,
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(repository.last).toBeNull();
    });
  });
});
