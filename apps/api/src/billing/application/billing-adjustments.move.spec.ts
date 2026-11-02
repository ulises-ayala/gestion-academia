import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import { BillingAdjustmentsService } from './billing-adjustments.service';

const charge = {
  id: 'cuota-nov',
  studentId: 'ana',
  enrollmentId: 'insc-salsa',
  kind: 'MONTHLY',
  status: 'PAID',
  period: new Date('2026-11-01T00:00:00.000Z'),
  enrollment: { class: { id: 'salsa', name: 'Salsa' } },
};
const enrollments: Record<string, object> = {
  'insc-bachata': {
    id: 'insc-bachata',
    studentId: 'ana',
    status: 'ACTIVE',
    class: { id: 'bachata', name: 'Bachata' },
  },
  'insc-zumba-finalizada': {
    id: 'insc-zumba-finalizada',
    studentId: 'ana',
    status: 'ENDED',
    class: { id: 'zumba', name: 'Zumba' },
  },
  'insc-de-otro': {
    id: 'insc-de-otro',
    studentId: 'otro',
    status: 'ACTIVE',
    class: { id: 'salsa', name: 'Salsa' },
  },
};

const setup = (over: { chargeOverride?: object; existing?: number } = {}) => {
  const current = { ...charge, ...over.chargeOverride };
  const tx = {
    $executeRaw: vi.fn(),
    monthlyCharge: {
      findUnique: vi.fn(async () => ({ studentId: current.studentId })),
      findUniqueOrThrow: vi.fn(async () => current),
      count: vi.fn(async () => over.existing ?? 0),
      update: vi.fn(async () => current),
    },
    enrollment: { findUnique: vi.fn(async ({ where }) => enrollments[where.id] ?? null) },
    auditLog: { create: vi.fn() },
  };
  const prisma = { $transaction: vi.fn(async (fn) => fn(tx)) } as unknown as PrismaService;
  return { tx, service: new BillingAdjustmentsService(prisma) };
};

describe('pasar una cuota a otra clase del alumno', () => {
  it('cambia solo la inscripción de la cuota y lo audita', async () => {
    const { tx, service } = setup();
    await expect(
      service.moveToEnrollment('cuota-nov', 'insc-bachata', ' Se cambió a Bachata ', 'admin'),
    ).resolves.toEqual({ id: 'cuota-nov', enrollmentId: 'insc-bachata' });
    expect(tx.monthlyCharge.update).toHaveBeenCalledWith({
      where: { id: 'cuota-nov' },
      data: { enrollmentId: 'insc-bachata' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'UPDATE',
        entityType: 'MONTHLY_CHARGE',
        reason: 'Se cambió a Bachata',
        before: { enrollmentId: 'insc-salsa', className: 'Salsa' },
        after: { enrollmentId: 'insc-bachata', className: 'Bachata' },
        metadata: { studentId: 'ana', source: 'CLASS_REASSIGNMENT' },
      }),
    });
  });

  it.each([
    ['otra persona', 'insc-de-otro', {}, 'ENROLLMENT_NOT_FOUND'],
    ['una inscripción finalizada', 'insc-zumba-finalizada', {}, 'ENROLLMENT_INACTIVE_FOR_CHARGE'],
    ['la misma clase', 'insc-salsa', {}, 'VALIDATION_ERROR'],
    [
      'una deuda anterior',
      'insc-bachata',
      { chargeOverride: { kind: 'HISTORICAL_DEBT' } },
      'CHARGE_NOT_MOVABLE',
    ],
    [
      'una clase que ya tiene la cuota del mes',
      'insc-bachata',
      { existing: 1 },
      'MONTHLY_CHARGE_ALREADY_EXISTS',
    ],
  ])('no deja pasarla a %s', async (_case, enrollmentId, over, code) => {
    const { tx, service } = setup(over);
    if (enrollmentId === 'insc-salsa')
      enrollments['insc-salsa'] = {
        id: 'insc-salsa',
        studentId: 'ana',
        status: 'ACTIVE',
        class: { id: 'salsa', name: 'Salsa' },
      };
    await expect(
      service.moveToEnrollment('cuota-nov', enrollmentId, 'motivo', 'admin'),
    ).rejects.toMatchObject({ code });
    expect(tx.monthlyCharge.update).not.toHaveBeenCalled();
  });

  it('exige motivo', async () => {
    const { service } = setup();
    await expect(
      service.moveToEnrollment('cuota-nov', 'insc-bachata', '  ', 'admin'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'reason' } });
  });
});
