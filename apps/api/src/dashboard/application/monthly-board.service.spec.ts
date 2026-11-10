import { Prisma } from '@academy/database';
import { describe, expect, it, vi } from 'vitest';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { rolePermissions } from '../../auth/domain/permissions';
import { PERMISSIONS_KEY } from '../../auth/presentation/permissions.decorator';
import type { PrismaService } from '../../database/prisma.service';
import { DashboardController } from '../presentation/dashboard.controller';
import { MonthlyBoardService } from './monthly-board.service';

const user = (role: PublicAuthUser['role']): PublicAuthUser => ({
  id: '00000000-0000-4000-8000-000000000001',
  username: role.toLowerCase(),
  role,
  status: 'ACTIVE',
});
const decimal = (value: string) => new Prisma.Decimal(value);
const now = new Date('2026-11-10T15:00:00.000Z');

const prismaMock = () => {
  const sqlText = (sql: { strings: readonly string[] }) => sql.strings.join(' ');
  return {
    $queryRaw: vi.fn().mockImplementation((sql: { strings: readonly string[] }) => {
      const text = sqlText(sql);
      if (text.includes('per_student'))
        return Promise.resolve([
          { month: '2026-10', activeStudents: 178n, newStudents: 11n, dropped: 6n },
          { month: '2026-11', activeStudents: 184n, newStudents: 14n, dropped: 8n },
        ]);
      if (text.includes('last_enrollment'))
        return Promise.resolve([{ reason: 'NON_PAYMENT', count: 5n }]);
      if (text.includes('student_attendances'))
        return Promise.resolve([{ classId: 'c1', records: 10n, present: 8n }]);
      if (text.includes('to_char'))
        return Promise.resolve([
          { month: '2026-10', amount: decimal('6700000') },
          { month: '2026-11', amount: decimal('7240000') },
        ]);
      if (text.includes('"paidAmount"'))
        return Promise.resolve([
          {
            paidAmount: decimal('780'),
            paidCount: 7n,
            openAmount: decimal('130'),
            openCount: 2n,
            overdueAmount: decimal('90'),
            overdueCount: 1n,
          },
        ]);
      if (
        !text.includes('oc.outstanding') &&
        text.includes('GROUP BY e.class_id') &&
        text.includes('monthly_charges mc ON')
      )
        return Promise.resolve([{ classId: 'c1', amount: decimal('400') }]);
      if (text.includes('oc.outstanding'))
        return Promise.resolve([{ classId: 'c1', amount: decimal('90') }]);
      if (text.includes('COUNT(DISTINCT student_id)'))
        return Promise.resolve([{ students: 23n, amount: decimal('640000') }]);
      if (text.includes('AS enrolled'))
        return Promise.resolve([
          { classId: 'c1', enrolled: 6n, started: 1n, ended: 2n },
          { classId: 'c2', enrolled: 20n, started: 0n, ended: 0n },
        ]);
      return Promise.resolve([]);
    }),
    academyClass: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'c2', name: 'Bachata', capacity: 20, teacher: { firstName: 'Ana', lastName: 'Paz' } },
        {
          id: 'c1',
          name: 'Kizomba',
          capacity: 20,
          teacher: { firstName: 'Leo', lastName: 'Sosa' },
        },
      ]),
    },
    lead: { count: vi.fn().mockResolvedValue(3) },
    paymentTender: {
      groupBy: vi.fn().mockResolvedValue([
        { method: 'CASH', _sum: { amount: decimal('100') } },
        { method: 'MERCADO_PAGO', _sum: { amount: decimal('300') } },
      ]),
    },
    payment: {
      groupBy: vi.fn().mockImplementation((args: { by: readonly string[] }) =>
        Promise.resolve(
          args.by.includes('classId')
            ? [{ classId: 'c1', _sum: { amount: decimal('50') } }]
            : [
                {
                  kind: 'CHARGES',
                  concept: null,
                  conceptId: null,
                  _sum: { amount: decimal('300') },
                },
                {
                  kind: 'OTHER',
                  concept: 'OTHER',
                  conceptId: 'k1',
                  _sum: { amount: decimal('100') },
                },
              ],
        ),
      ),
    },
    paymentConcept: {
      findMany: vi.fn().mockResolvedValue([{ id: 'k1', name: 'Indumentaria' }]),
    },
  };
};
const service = (prisma: ReturnType<typeof prismaMock>) =>
  new MonthlyBoardService(prisma as unknown as PrismaService);

describe('MonthlyBoardService', () => {
  it('Admisión ve alumnos, clases y potenciales, sin ningún importe', async () => {
    const prisma = prismaMock();
    const board = await service(prisma).get(user('RECEPTION'), undefined, now);
    expect(board.month).toBe('2026-11');
    expect(board.inProgress).toBe(true);
    expect(board.history).toHaveLength(6);
    expect(board.history.at(-1)).toEqual({
      month: '2026-11',
      label: 'Noviembre 2026',
      shortLabel: 'Nov',
      activeStudents: 184,
      newStudents: 14,
      dropped: 8,
    });
    expect(board.dropReasons).toEqual([{ reason: 'NON_PAYMENT', label: 'Morosidad', count: 5 }]);
    expect(board.overdueStudents).toBe(23);
    // De menor a mayor ocupación.
    expect(board.classes.map((item) => item.name)).toEqual(['Kizomba', 'Bachata']);
    expect(board.classes[0]).toEqual({
      id: 'c1',
      name: 'Kizomba',
      teacher: 'Leo Sosa',
      capacity: 20,
      enrolled: 6,
      started: 1,
      ended: 2,
      attendancePercent: 80,
    });
    expect(board.classes[1]!.attendancePercent).toBeNull();
    expect(board.money).toBeUndefined();
    expect(JSON.stringify(board)).not.toMatch(/collected|overdueDebt|640000/);
    expect(prisma.paymentTender.groupBy).not.toHaveBeenCalled();
    expect(prisma.payment.groupBy).not.toHaveBeenCalled();
  });

  it('Administración y Dirección reciben además los importes', async () => {
    for (const role of ['MANAGER', 'ADMINISTRATOR'] as const) {
      const board = await service(prismaMock()).get(user(role), '2026-11', now);
      expect(board.history.at(-1)!.collected).toBe('7240000.00');
      expect(board.history[0]!.collected).toBe('0.00');
      expect(board.classes[0]).toMatchObject({ collected: '450.00', overdue: '90.00' });
      expect(board.money).toEqual({
        overdueDebt: '640000.00',
        charges: {
          total: '1000.00',
          paidAmount: '780.00',
          paidCount: 7,
          openAmount: '130.00',
          openCount: 2,
          overdueAmount: '90.00',
          overdueCount: 1,
        },
        byMethod: [
          { method: 'MERCADO_PAGO', label: 'Mercado Pago', amount: '300.00' },
          { method: 'CASH', label: 'Efectivo', amount: '100.00' },
        ],
        byConcept: [
          { key: 'CHARGES', label: 'Cuotas', amount: '300.00' },
          { key: 'k1', label: 'Indumentaria', amount: '100.00' },
        ],
      });
    }
  });

  it('un mes anterior no figura en curso y uno futuro se rechaza', async () => {
    const board = await service(prismaMock()).get(user('MANAGER'), '2026-10', now);
    expect(board.label).toBe('Octubre 2026');
    expect(board.inProgress).toBe(false);
    await expect(service(prismaMock()).get(user('MANAGER'), '2026-12', now)).rejects.toThrow(
      'todavía no empezó',
    );
  });

  it('el endpoint exige students:manage, que tienen los tres roles', () => {
    const handler = (DashboardController.prototype as unknown as Record<string, object>)
      .getMonthly!;
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual(['students:manage']);
    for (const role of ['RECEPTION', 'MANAGER', 'ADMINISTRATOR'] as const)
      expect(rolePermissions[role]).toContain('students:manage');
    expect(rolePermissions.RECEPTION).not.toContain('reports:operational');
  });
});
