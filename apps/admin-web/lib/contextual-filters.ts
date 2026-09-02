import type { LeadStatusDto, StudentStatusDto } from '@academy/contracts';
import type { UiPermission } from './permissions';

export const dashboardContextLinks = {
  activeStudents: '/students?status=ACTIVE',
  pendingDebt: '/payments?view=pending',
  overdueCharges: '/payments?view=overdue',
  overdueFollowUps: '/leads?followUp=overdue',
} as const;

export const dashboardQuickActions: readonly [string, string, UiPermission][] = [
  ['Nuevo alumno', '/students/new', 'students:manage'],
  ['Registrar pago', '/payments', 'payments:collect'],
  ['Tomar asistencia', '/attendances', 'attendance:manage'],
  ['Nuevo potencial', '/leads/new', 'leads:manage'],
  ['Inscribir alumno', dashboardContextLinks.activeStudents, 'enrollments:manage'],
  ['Abrir o consultar caja', '/cash', 'cash:manage'],
];

export const safePaymentReturnTo = (search: string) => {
  const value = new URLSearchParams(search).get('returnTo');
  if (!value || !value.startsWith('/payments') || value.startsWith('//') || value.includes('\\'))
    return '';
  const url = new URL(value, 'https://internal.invalid');
  return url.origin === 'https://internal.invalid' && url.pathname === '/payments'
    ? `${url.pathname}${url.search}${url.hash}`
    : '';
};

export const cashHrefForPayment = (paymentSearch: string) =>
  `/cash?${new URLSearchParams({ returnTo: `/payments${paymentSearch}` })}`;

export const paymentViewFromSearch = (search: string): '' | 'pending' | 'overdue' => {
  const value = new URLSearchParams(search).get('view');
  return value === 'pending' || value === 'overdue' ? value : '';
};

export const studentStatusFromSearch = (search: string): '' | StudentStatusDto => {
  const value = new URLSearchParams(search).get('status');
  return value === 'ACTIVE' || value === 'INACTIVE' ? value : '';
};

export const leadFiltersFromSearch = (search: string) => {
  const params = new URLSearchParams(search);
  const status = params.get('status');
  const followUp = params.get('followUp');
  return {
    status: (['INQUIRY', 'INTERESTED', 'TRIAL', 'ENROLLED', 'NOT_CONVERTED'].includes(status ?? '')
      ? status
      : '') as '' | LeadStatusDto,
    followUp: (followUp === 'overdue' || followUp === 'OVERDUE'
      ? 'OVERDUE'
      : followUp === 'pending' || followUp === 'PENDING'
        ? 'PENDING'
        : '') as '' | 'PENDING' | 'OVERDUE',
  };
};

export const attendanceDateFromSearch = (search: string, fallback: string) => {
  const value = new URLSearchParams(search).get('date');
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
};
