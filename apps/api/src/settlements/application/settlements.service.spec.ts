import { Prisma } from '@academy/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import type { PrismaService } from '../../database/prisma.service';
import { SettlementsService } from './settlements.service';

const d = (value: number) => new Prisma.Decimal(value);
const actor = { id: 'dir', username: 'charo', role: 'ADMINISTRATOR' } as PublicAuthUser;
const chargeRow = {
  paymentId: 'p1',
  paidAt: new Date('2026-10-15T15:00:00.000Z'),
  studentName: 'Ana Pérez',
  classId: 'zumba',
  className: 'Zumba',
  chargeKind: 'MONTHLY',
  chargePeriod: '2026-10',
  collected: d(20000),
  baseAmount: d(40000),
  studentDelta: d(-20000),
  settlementDelta: d(0),
};

const setup = (over: { closing?: object | null; createError?: unknown } = {}) => {
  const tx = {
    settlementClosing: {
      create: vi.fn(async () => {
        if (over.createError) throw over.createError;
        return { id: 'cierre' };
      }),
      findUnique: vi.fn(async () => over.closing ?? null),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([chargeRow])
      .mockResolvedValueOnce([])
      .mockResolvedValue([]),
    payment: { aggregate: vi.fn(async () => ({ _sum: { amount: d(15000) } })) },
    classSettlementPlan: {
      findMany: vi.fn(async () => [
        {
          classId: 'zumba',
          validFrom: new Date('2026-01-01T00:00:00.000Z'),
          shares: [{ teacherId: 'joselo', percentage: d(60) }],
        },
      ]),
    },
    teacher: {
      findMany: vi.fn(async () => [{ id: 'joselo', firstName: 'Jose Luis', lastName: 'Barrios' }]),
    },
    settlementClosing: { findUnique: vi.fn(async () => over.closing ?? null) },
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaService;
  return { tx, prisma, service: new SettlementsService(prisma) };
};

describe('liquidación del mes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T15:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('calcula con la beca de Dirección a cargo de la academia y deja cerrar un mes terminado', async () => {
    const { service } = setup();
    const result = await service.get('2026-10');
    expect(result).toMatchObject({
      period: '2026-10',
      status: 'OPEN',
      canClose: true,
      totals: { collected: '35000.00', teachers: '24000.00', academy: '11000.00' },
    });
    expect(result.teachers[0]).toMatchObject({
      teacher: { lastName: 'Barrios' },
      total: '24000.00',
      lines: [{ collected: '20000.00', base: '40000.00', percentage: '60.00' }],
    });
  });

  it('no cierra el mes en curso', async () => {
    const { service, tx } = setup();
    await expect(service.close('2026-11', undefined, actor)).rejects.toMatchObject({
      code: 'SETTLEMENT_MONTH_NOT_ENDED',
    });
    expect(tx.settlementClosing.create).not.toHaveBeenCalled();
  });

  it('guarda la foto del mes y lo audita; un segundo cierre es un conflicto', async () => {
    const { service, tx } = setup();
    await service.close('2026-10', ' Pagado a los profes ', actor);
    expect(tx.settlementClosing.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        period: new Date('2026-10-01T00:00:00.000Z'),
        note: 'Pagado a los profes',
        closedByUserId: 'dir',
        snapshot: expect.objectContaining({ period: '2026-10' }),
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'CLOSE', entityType: 'SETTLEMENT' }),
    });
    const duplicate = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    await expect(
      setup({ createError: duplicate }).service.close('2026-10', undefined, actor),
    ).rejects.toMatchObject({ code: 'SETTLEMENT_CLOSED_CONFLICT' });
  });

  it('un mes cerrado devuelve lo guardado aunque los cobros cambien', async () => {
    const snapshot = { period: '2026-09', totals: { academy: '1.00' }, teachers: [] };
    const { service, prisma } = setup({
      closing: {
        id: 'cierre',
        snapshot,
        note: null,
        closedAt: new Date('2026-10-02T12:00:00.000Z'),
        closedBy: { id: 'dir', username: 'charo' },
      },
    });
    await expect(service.get('2026-09')).resolves.toMatchObject({
      status: 'CLOSED',
      canClose: false,
      totals: { academy: '1.00' },
      closedBy: { username: 'charo' },
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('reabrir exige motivo y borra el cierre', async () => {
    const closing = {
      id: 'cierre',
      snapshot: { totals: { academy: '1.00' } },
      closedAt: new Date('2026-10-02T12:00:00.000Z'),
    };
    await expect(setup({ closing }).service.reopen('2026-09', ' ', actor)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(setup().service.reopen('2026-09', 'Error', actor)).rejects.toMatchObject({
      code: 'SETTLEMENT_NOT_FOUND',
    });
    const { service, tx } = setup({ closing });
    await service.reopen('2026-09', 'Faltaba un pago', actor).catch(() => undefined);
    expect(tx.settlementClosing.delete).toHaveBeenCalledWith({ where: { id: 'cierre' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'OPEN', reason: 'Faltaba un pago' }),
    });
  });
});
