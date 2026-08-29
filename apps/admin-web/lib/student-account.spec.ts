import { describe, expect, it } from 'vitest';
import type { EnrollmentDto, MonthlyChargeDto } from '@academy/contracts';
import { isOverdueCharge, sortAccountCharges, studentAccountSummary } from './student-account';

const enrollment = (status: 'ACTIVE' | 'ENDED') => ({ status }) as EnrollmentDto;
const charge = (status: 'PENDING' | 'PAID' | 'VOID', amount: string, dueDate = '2026-08-20') =>
  ({
    id: crypto.randomUUID(),
    status,
    finalAmount: amount,
    dueDate,
    period: dueDate.slice(0, 7),
  }) as MonthlyChargeDto;
describe('student account view', () => {
  it('calcula clases, deuda, vencidas y total pagado con precisión decimal', () => {
    const result = studentAccountSummary(
      [enrollment('ACTIVE'), enrollment('ENDED')],
      [charge('PENDING', '40000.00'), charge('PAID', '50000.00'), charge('VOID', '60000.00')],
      '160000.00',
      '2026-08-29',
    );
    expect(result).toEqual({
      activeClasses: 1,
      pendingDebt: '40000.00',
      overdueCharges: 1,
      totalPaid: '160000.00',
    });
  });
  it('deriva vencimiento sin crear un estado nuevo y ordena vencidas primero', () => {
    const future = charge('PENDING', '1.00', '2026-09-10');
    const overdue = charge('PENDING', '1.00', '2026-08-10');
    expect(isOverdueCharge(overdue, '2026-08-29')).toBe(true);
    expect(isOverdueCharge(charge('PAID', '1.00'), '2026-08-29')).toBe(false);
    expect(sortAccountCharges([future, overdue], '2026-08-29')[0]?.id).toBe(overdue.id);
  });
});
