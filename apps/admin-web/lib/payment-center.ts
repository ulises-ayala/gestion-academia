import type {
  PaymentMethodDto,
  PaymentStatusDto,
  ReceivablesScopeDto,
  ReceivablesSortDto,
} from '@academy/contracts';

export type PaymentTab = 'accounts' | 'history';
export type PaymentLocation = Readonly<{
  tab: PaymentTab;
  studentId: string;
  action: '' | 'collect';
  scope: ReceivablesScopeDto;
  q: string;
  sort: ReceivablesSortDto;
  page: number;
  historyQ: string;
  paymentStatus: '' | PaymentStatusDto;
  paymentMethod: '' | PaymentMethodDto;
  from: string;
  to: string;
  historyPage: number;
}>;

const positivePage = (value: string | null) =>
  value && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : 1;
const date = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '');

export const paymentLocationFromSearch = (search: string): PaymentLocation => {
  const params = new URLSearchParams(search);
  const view = params.get('view');
  const sort = params.get('sort');
  const status = params.get('paymentStatus');
  const method = params.get('method');
  return {
    tab: params.get('tab') === 'history' ? 'history' : 'accounts',
    studentId: params.get('studentId') ?? '',
    action: params.get('action') === 'collect' ? 'collect' : '',
    scope: (['pending', 'overdue', 'partial', 'unpaid'].includes(view ?? '')
      ? view
      : 'pending') as ReceivablesScopeDto,
    q: params.get('q')?.trim() ?? '',
    sort: (['oldest', 'highest-debt', 'name'].includes(sort ?? '')
      ? sort
      : 'oldest') as ReceivablesSortDto,
    page: positivePage(params.get('page')),
    historyQ: params.get('historyQ')?.trim() ?? '',
    paymentStatus: (status === 'CONFIRMED' || status === 'VOID' ? status : '') as
      | ''
      | PaymentStatusDto,
    paymentMethod: (['CASH', 'MERCADO_PAGO', 'CARD'].includes(method ?? '') ? method : '') as
      | ''
      | PaymentMethodDto,
    from: date(params.get('from')),
    to: date(params.get('to')),
    historyPage: positivePage(params.get('historyPage')),
  };
};

export const paymentSearch = (
  currentSearch: string,
  updates: Readonly<Record<string, string | number | null>>,
) => {
  const params = new URLSearchParams(currentSearch);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') params.delete(key);
    else params.set(key, String(value));
  }
  const result = params.toString();
  return result ? `/payments?${result}` : '/payments';
};

export const paymentBackHref = (search: string) =>
  paymentSearch(search, { studentId: null, action: null });
