import type { ReactNode } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { RequirePermission } from '../../components/permission-gate';

export default function SettlementsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AdminShell>
      <RequirePermission permission="settlements:manage">{children}</RequirePermission>
    </AdminShell>
  );
}
