import { describe, expect, it } from 'vitest';
import {
  attendanceDateFromSearch,
  dashboardContextLinks,
  dashboardQuickActions,
  leadFiltersFromSearch,
  paymentViewFromSearch,
  studentStatusFromSearch,
} from './contextual-filters';

describe('contextual dashboard filters', () => {
  it('reads student status', () =>
    expect(studentStatusFromSearch('?status=ACTIVE')).toBe('ACTIVE'));
  it('reads lead status and overdue follow-up', () =>
    expect(leadFiltersFromSearch('?status=TRIAL&followUp=overdue')).toEqual({
      status: 'TRIAL',
      followUp: 'OVERDUE',
    }));
  it('reads a valid attendance date and rejects invalid values', () => {
    expect(attendanceDateFromSearch('?date=2026-08-30', 'fallback')).toBe('2026-08-30');
    expect(attendanceDateFromSearch('?date=no', 'fallback')).toBe('fallback');
  });
  it('defines actionable dashboard deep links', () => {
    expect(dashboardContextLinks).toMatchObject({
      activeStudents: '/students?status=ACTIVE',
      pendingDebt: '/payments?view=pending',
      overdueCharges: '/payments?view=overdue',
      overdueFollowUps: '/leads?followUp=overdue',
    });
    expect(dashboardQuickActions.map(([label]) => label)).toContain('Inscribir alumno');
    expect(paymentViewFromSearch('?view=overdue')).toBe('overdue');
  });
});
