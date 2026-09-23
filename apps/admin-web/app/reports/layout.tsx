import type { ReactNode } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { RequirePermission } from '../../components/permission-gate';

export default function ReportsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AdminShell>
      <RequirePermission permission="reports:operational">{children}</RequirePermission>
    </AdminShell>
  );
}
