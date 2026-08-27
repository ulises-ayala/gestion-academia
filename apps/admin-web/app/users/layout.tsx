import type { ReactNode } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { RequirePermission } from '../../components/permission-gate';

export default function UsersLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AdminShell>
      <RequirePermission permission="users:manage">{children}</RequirePermission>
    </AdminShell>
  );
}
