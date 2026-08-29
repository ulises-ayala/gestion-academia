import type { ReactNode } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { RequirePermission } from '../../components/permission-gate';

export default function AuditLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AdminShell>
      <RequirePermission permission="audit:read">{children}</RequirePermission>
    </AdminShell>
  );
}
