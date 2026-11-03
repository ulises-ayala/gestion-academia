import type { ReactNode } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { RequirePermission } from '../../components/permission-gate';
export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AdminShell>
      <RequirePermission permission="cash:reconcile">{children}</RequirePermission>
    </AdminShell>
  );
}
